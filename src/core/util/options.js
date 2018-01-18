/* @flow */

import Vue from '../instance/index'
import config from '../config'
import { warn } from './debug'
import { set } from '../observer/index'
import {
  extend,
  isPlainObject,
  hasOwn,
  camelize,
  capitalize,
  isBuiltInTag
} from 'shared/util'

/**
 * Option overwriting strategies are functions that handle
 * how to merge a parent option value and a child option
 * value into the final value.
 */
/**
 * 我们传递给options的自定义的选项合并策略
 */
const strats = config.optionMergeStrategies

/**
 * 下面就是设定的一些config.optionMergeStrategies的一些默认的合并策略
 */

/**
 * Options with restrictions
 */
if (process.env.NODE_ENV !== 'production') {
  strats.el = strats.propsData = function (parent, child, vm, key) {
    if (!vm) {
      warn(
        `option "${key}" can only be used during instance ` +
        'creation with the `new` keyword.'
      )
    }
    return defaultStrat(parent, child)
  }
}

/**
 * Helper that recursively merges two data objects together.
 */
// 合并data的策略
function mergeData (to: Object, from: ?Object): Object {
  // 如果要合并的对象不存在，直接返回源对象
  if (!from) return to
  // 
  let key, toVal, fromVal
  const keys = Object.keys(from)
  for (let i = 0; i < keys.length; i++) {
    key = keys[i]
    toVal = to[key]
    fromVal = from[key]
    // 如果在源对象中不存在这个属性，将这个属性添加到源对象中
    if (!hasOwn(to, key)) {
      set(to, key, fromVal)
    } else if (isPlainObject(toVal) && isPlainObject(fromVal)) {
      // 另外一种情况，源对象和目标对象两者都是pure object的时候，才会进行合并
      mergeData(toVal, fromVal)
    }
  }
  // 综上，也就是说，data的合并，只会合并那些不存在的属性，值为object的属性，也会合并不存在的属性。
  return to
}

/**
 * Data
 */
strats.data = function (
  parentVal: any,
  childVal: any,
  vm?: Component
): ?Function {
  if (!vm) {
    // 调用Vue.extend方法所进行的合并策略的时候
    // in a Vue.extend merge, both should be functions
    if (!childVal) {
      return parentVal
    }
    // 要求Vue.extend中的data选项应该是一个函数
    if (typeof childVal !== 'function') {
      process.env.NODE_ENV !== 'production' && warn(
        'The "data" option should be a function ' +
        'that returns a per-instance value in component ' +
        'definitions.',
        vm
      )
      return parentVal
    }
    if (!parentVal) {
      return childVal
    }
    // when parentVal & childVal are both present,
    // we need to return a function that returns the
    // merged result of both functions... no need to
    // check if parentVal is a function here because
    // it has to be a function to pass previous merges.
    // <<<<<?>>>>>
    return function mergedDataFn () {
      return mergeData(
        childVal.call(this),
        parentVal.call(this)
      )
    }
  } else if (parentVal || childVal) {
    // 创建Vue实例的时候data合并
    return function mergedInstanceDataFn () {
      // console.log(vm === this)
      // instance merge
      const instanceData = typeof childVal === 'function'
        ? childVal.call(vm)
        : childVal
      // 如果parent 的options中的data不是一个函数，直接忽略
      const defaultData = typeof parentVal === 'function'
        ? parentVal.call(vm)
        : undefined
      if (instanceData) {
        return mergeData(instanceData, defaultData)
      } else {
        // console.log(123)
        // console.log(vm.$data)
        return defaultData
      }
    }
  }
}

/**
 * Hooks and props are merged as arrays.
 */
// 合并钩子函数和props的策略
function mergeHook (
  parentVal: ?Array<Function>,
  childVal: ?Function | ?Array<Function>
): ?Array<Function> {
  return childVal
    ? parentVal
      ? parentVal.concat(childVal)
      : Array.isArray(childVal)
        ? childVal
        : [childVal]
    : parentVal
}

config._lifecycleHooks.forEach(hook => {
  strats[hook] = mergeHook
})

/**
 * Assets
 *
 * When a vm is present (instance creation), we need to do
 * a three-way merge between constructor options, instance
 * options and parent options.
 */
function mergeAssets (parentVal: ?Object, childVal: ?Object): Object {
  const res = Object.create(parentVal || null)
  return childVal
    ? extend(res, childVal)
    : res
}

config._assetTypes.forEach(function (type) {
  strats[type + 's'] = mergeAssets
})

/**
 * Watchers.
 *
 * Watchers hashes should not overwrite one
 * another, so we merge them as arrays.
 */
strats.watch = function (parentVal: ?Object, childVal: ?Object): ?Object {
  /* istanbul ignore if */
  if (!childVal) return Object.create(parentVal || null)
  if (!parentVal) return childVal
  const ret = {}
  extend(ret, parentVal)
  for (const key in childVal) {
    let parent = ret[key]
    const child = childVal[key]
    if (parent && !Array.isArray(parent)) {
      parent = [parent]
    }
    ret[key] = parent
      ? parent.concat(child)
      : [child]
  }
  return ret
}

/**
 * Other object hashes.
 */
strats.props =
strats.methods =
strats.computed = function (parentVal: ?Object, childVal: ?Object): ?Object {
  if (!childVal) return Object.create(parentVal || null)
  if (!parentVal) return childVal
  const ret = Object.create(null)
  // 同名的方法会进行覆盖
  extend(ret, parentVal)
  extend(ret, childVal)
  return ret
}

/**
 * Default strategy.
 */
// 自定义选项将使用默认策略，即简单地覆盖已有值。
// https://cn.vuejs.org/v2/guide/mixins.html#%E8%87%AA%E5%AE%9A%E4%B9%89%E9%80%89%E9%A1%B9%E5%90%88%E5%B9%B6%E7%AD%96%E7%95%A5
const defaultStrat = function (parentVal: any, childVal: any): any {
  return childVal === undefined
    ? parentVal
    : childVal
}

/**
 * Validate component names
 */
/**
 * 检查组件的名称
 */
function checkComponents (options: Object) {
  for (const key in options.components) {
    const lower = key.toLowerCase()
    // 如果是内置标签(components, slot)或者是html的保留标签会给予警告
    if (isBuiltInTag(lower) || config.isReservedTag(lower)) {
      warn(
        'Do not use built-in or reserved HTML elements as component ' +
        'id: ' + key
      )
    }
  }
}

/**
 * Ensure all props option syntax are normalized into the
 * Object-based format.
 */
/**
 * 把props统一转换成对象格式
 * props可以设定为：string, array, object
 */
function normalizeProps (options: Object) {
  const props = options.props
  if (!props) return
  const res = {}
  let i, val, name
  // 如果props是数组格式的，就会被统一转换成{[value]: {type: null}}
  if (Array.isArray(props)) {
    i = props.length
    while (i--) {
      val = props[i]
      if (typeof val === 'string') {
        // 转hyphen-delimited －> hyphenDelimited
        name = camelize(val)
        res[name] = { type: null }
      } else if (process.env.NODE_ENV !== 'production') {
        // 数组中的元素只能是字符串类型的,在开发环境下传入非字符串形式的元素会给予警告
        // 并忽略掉这个props
        warn('props must be strings when using array syntax.')
      }
    }
  } else if (isPlainObject(props)) {
    // 如果纯object的形势
    for (const key in props) {
      val = props[key]
      name = camelize(key)
      res[name] = isPlainObject(val)
        ? val
        : { type: val }
    }
  }
  // 最终的props的形势为
  /**
   * {
   *  [camelize(name)]: {
   *    type: null 或者 类型,
   *    ...
   *  }
   * }
   */
  options.props = res
}

/**
 * Normalize raw function directives into object format.
 */
// 这就是我们为什么能够为指令设置为一个函数
// 这里会把函数形式的指令，自动转换为对象形式的，其中
// 会包含bind和update两个钩子
// https://cn.vuejs.org/v2/guide/custom-directive.html#%E5%87%BD%E6%95%B0%E7%AE%80%E5%86%99
function normalizeDirectives (options: Object) {
  const dirs = options.directives
  if (dirs) {
    for (const key in dirs) {
      const def = dirs[key]
      if (typeof def === 'function') {
        dirs[key] = { bind: def, update: def }
      }
    }
  }
}

/**
 * Merge two option objects into a new one.
 * Core utility used in both instantiation and inheritance.
 */
/**
 * 把两个options对象合并成一个，是实现实例化和继承的核心工具
 * 实例化： new Vue(options)
 * 继承：Vue.extend(options)
 */
export function mergeOptions (
  parent: Object,
  child: Object,
  vm?: Component
): Object {
  if (process.env.NODE_ENV !== 'production') {
    // 开发环境下会检查child选项的components选项的名称是否合法
    checkComponents(child)
  }
  // 格式化props
  normalizeProps(child)
  // 格式化directives
  normalizeDirectives(child)
  // 允许声明扩展另一个组件(可以是一个简单的选项对象或构造函数)，而无需使用 Vue.extend。
  // 这主要是为了便于扩展单文件组件。
  // https://cn.vuejs.org/v2/api/#extends
  const extendsFrom = child.extends
  if (extendsFrom) {
    // 把extends的构造函数或者组件中的options合并到parent上
    parent = typeof extendsFrom === 'function'
      ? mergeOptions(parent, extendsFrom.options, vm)
      : mergeOptions(parent, extendsFrom, vm)
  }
  // 合并child的mixins
  if (child.mixins) {
    for (let i = 0, l = child.mixins.length; i < l; i++) {
      let mixin = child.mixins[i]
      // mixin也可以是Vue的一个实例
      if (mixin.prototype instanceof Vue) {
        // 获取实例这个mixin元素时候的初始化选项
        mixin = mixin.options
      }
      // 把合并结果赋给parent，总之一定要保证child中的所有选项具有最高的优先级
      parent = mergeOptions(parent, mixin, vm)
    }
  }
  const options = {}
  let key
  for (key in parent) {
    mergeField(key)
  }
  for (key in child) {
    if (!hasOwn(parent, key)) {
      mergeField(key)
    }
  }
  function mergeField (key) {
    // 如果没有设定选项的合并策略，则使用默认的合并策略，简单的覆盖已有值。
    const strat = strats[key] || defaultStrat
    // 合并策略的返回值作为最终选项对象的结果
    options[key] = strat(parent[key], child[key], vm, key)
  }
  return options
}

/**
 * Resolve an asset.
 * This function is used because child instances need access
 * to assets defined in its ancestor chain.
 */
export function resolveAsset (
  options: Object,
  type: string,
  id: string,
  warnMissing?: boolean
): any {
  /* istanbul ignore if */
  if (typeof id !== 'string') {
    return
  }
  const assets = options[type]
  // check local registration variations first
  if (hasOwn(assets, id)) return assets[id]
  const camelizedId = camelize(id)
  if (hasOwn(assets, camelizedId)) return assets[camelizedId]
  const PascalCaseId = capitalize(camelizedId)
  if (hasOwn(assets, PascalCaseId)) return assets[PascalCaseId]
  // fallback to prototype chain
  const res = assets[id] || assets[camelizedId] || assets[PascalCaseId]
  if (process.env.NODE_ENV !== 'production' && warnMissing && !res) {
    warn(
      'Failed to resolve ' + type.slice(0, -1) + ': ' + id,
      options
    )
  }
  return res
}
