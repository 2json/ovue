/* @flow */

import config from '../config'
import { initProxy } from './proxy'
import { initState } from './state'
import { initRender } from './render'
import { initEvents } from './events'
import { mark, measure } from '../util/perf'
import { initLifecycle, callHook } from './lifecycle'
import { initProvide, initInjections } from './inject'
import { extend, mergeOptions, formatComponentName } from '../util/index'

let uid = 0

export function initMixin (Vue: Class<Component>) {
  Vue.prototype._init = function (options?: Object) {
    const vm: Component = this
    // a uid
    // 用于标示vue实例的一个数字，初始化是0，我们每次通过new Vue创建vue实例的时候，这个值都会递增1
    vm._uid = uid++

    // 下面这段代码主要是和性能统计相关的，开发环境才会执行，生产环境下会忽略。
    let startTag, endTag
    /* istanbul ignore if */
    if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
      startTag = `vue-perf-init:${vm._uid}`
      endTag = `vue-perf-end:${vm._uid}`
      mark(startTag)
    }

    // a flag to avoid this being observed
    // 设置一个标示，这个标示主要用于在监听对象变化的时候，过滤掉对vm实例的监听
    vm._isVue = true
    // merge options
    // options._isComponent主要用于标示组件是否为内部创建
    if (options && options._isComponent) {
      // optimize internal component instantiation
      // since dynamic options merging is pretty slow, and none of the
      // internal component options needs special treatment.
      initInternalComponent(vm, options)
    } else {
      // 设置vue实例的$options为合并后的options结果
      // 我们在创建vue实例的时候，vue会把一些内部创建的已有的特性合并到我们我们传递的选项参数中
      // 这些内部的特性主要有components比我keep-alive,transition,transition-group
      // directives:model, show
      // 和一些filters
      // 这些内建的特性被合并之后，我们就可以在我们的组件中直接使用。
      vm.$options = mergeOptions(
        // 这里的vm.constructor就是传入的Vue构造函数
        // resolveConstructorOptions这个方法主要用语合并构造器及构造器父级上所定义的options
        resolveConstructorOptions(vm.constructor),
        options || {},
        vm
      )
    }
    /* istanbul ignore else */
    if (process.env.NODE_ENV !== 'production') {
      // 开发环境下，绑定vm._renderProxy为一个Proxy对象
      // 主要代理的就是config.keyCodes和vm._renderProxy对象
      initProxy(vm)
    } else {
      // 生产环境下就是vm自身
      vm._renderProxy = vm
    }
    // expose real self
    vm._self = vm
    // 给vm添加$root, $parent, $children, $refs属性以及一些和生命周期相关的标识
    initLifecycle(vm)
    initEvents(vm)
    initRender(vm)
    callHook(vm, 'beforeCreate')
    initInjections(vm) // resolve injections before data/props
    initState(vm)
    initProvide(vm) // resolve provide after data/props
    callHook(vm, 'created')

    /* istanbul ignore if */
    if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
      vm._name = formatComponentName(vm, false)
      mark(endTag)
      measure(`${vm._name} init`, startTag, endTag)
    }

    if (vm.$options.el) {
      vm.$mount(vm.$options.el)
    }
  }
}

function initInternalComponent (vm: Component, options: InternalComponentOptions) {
  const opts = vm.$options = Object.create(vm.constructor.options)
  // doing this because it's faster than dynamic enumeration.
  opts.parent = options.parent
  opts.propsData = options.propsData
  opts._parentVnode = options._parentVnode
  opts._parentListeners = options._parentListeners
  opts._renderChildren = options._renderChildren
  opts._componentTag = options._componentTag
  opts._parentElm = options._parentElm
  opts._refElm = options._refElm
  if (options.render) {
    opts.render = options.render
    opts.staticRenderFns = options.staticRenderFns
  }
}

export function resolveConstructorOptions (Ctor: Class<Component>) {
  // 获取Vue构造函数上的静态属性options  在initGlobalAPI 中被定义
  let options = Ctor.options
  // 如果存在父级，super这个属性，只有在我们调用Vue.extend才会添加的属性
  if (Ctor.super) {
    // 获取父级上的静态属性options
    const superOptions = resolveConstructorOptions(Ctor.super)
    // 获取构造函数上已经保存下来的父级静态属性options
    const cachedSuperOptions = Ctor.superOptions
    // 如果父级上的静态属性改变了
    if (superOptions !== cachedSuperOptions) {
      // super option changed,
      // need to resolve new options.
      // 更新被缓存下来的静态属性
      Ctor.superOptions = superOptions
      // check if there are any late-modified/attached options (#4976)
      // 检查是否存在一些后面添加和更新的属性
      const modifiedOptions = resolveModifiedOptions(Ctor)
      // update base extend options
      if (modifiedOptions) {
        // 通过Vue.extend创建一个构造函数的时候，才会有这个属性
        extend(Ctor.extendOptions, modifiedOptions)
      }
      options = Ctor.options = mergeOptions(superOptions, Ctor.extendOptions)
      // 如果传递了name属性，则会通过这个name进行一个对这个构造函数的引用
      if (options.name) {
        options.components[options.name] = Ctor
      }
    }
  }
  return options
}

function resolveModifiedOptions (Ctor: Class<Component>): ?Object {
  // 保存被编辑的属性
  let modified
  // 先获取
  const latest = Ctor.options
  // 这个属性是什么？？？？现在还不知道？？？ <<<<<?>>>>>
  const sealed = Ctor.sealedOptions
  for (const key in latest) {
    if (latest[key] !== sealed[key]) {
      // 如果有属性被编辑了
      if (!modified) modified = {}
      modified[key] = dedupe(latest[key], sealed[key])
    }
  }
  // 如果有属性被编辑，则，这个值就是一个object，否则就是undefined｀
  return modified
}

function dedupe (latest, sealed) {
  // compare latest and sealed to ensure lifecycle hooks won't be duplicated
  // between merges
  // <<<<<?>>>>>
  if (Array.isArray(latest)) {
    const res = []
    sealed = Array.isArray(sealed) ? sealed : [sealed]
    for (let i = 0; i < latest.length; i++) {
      // 以sealed为标准，求两个数组的差级
      if (sealed.indexOf(latest[i]) < 0) {
        res.push(latest[i])
      }
    }
    return res
  } else {
    return latest
  }
}
