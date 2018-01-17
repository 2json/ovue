/* @flow */

import Vue from './web-runtime'
import config from 'core/config'
import { query } from 'web/util/index'
import { warn, cached } from 'core/util/index'
import { mark, measure } from 'core/util/perf'
import { shouldDecodeNewlines } from 'web/util/compat'
import { compileToFunctions } from 'web/compiler/index'

const idToTemplate = cached(id => {
  const el = query(id)
  return el && el.innerHTML
})


const mount = Vue.prototype.$mount
// 定义 Vue.prototype.$mount这个方法
Vue.prototype.$mount = function (
  el?: string | Element,
  hydrating?: boolean
): Component {
  el = el && query(el)

  /* istanbul ignore if */
  if (el === document.body || el === document.documentElement) {
    // 是不允许将Vue挂载到body或者html上的。
    process.env.NODE_ENV !== 'production' && warn(
      `Do not mount Vue to <html> or <body> - mount to normal elements instead.`
    )
    return this
  }

  // 传给vue构造函数的选项
  const options = this.$options
  // resolve template/el and convert to render function
  if (!options.render) {
    // 如果没有向options传递render方法，获取选项的template选项
    let template = options.template
    // 如果存在template选项
    if (template) {
      if (typeof template === 'string') {
        // template选项是字符串，而且是以#开头的
        if (template.charAt(0) === '#') {
          // 获取到template innerHTML内容
          template = idToTemplate(template)
          /* istanbul ignore if */
          if (process.env.NODE_ENV !== 'production' && !template) {
            warn(
              `Template element not found or is empty: ${options.template}`,
              this
            )
          }
        }
      } else if (template.nodeType) {
        // 如果template是一个node节点，直接获取其innerHTML内容
        template = template.innerHTML
      } else {
        // 无效的template选项，在非生产环境下给予警告
        if (process.env.NODE_ENV !== 'production') {
          warn('invalid template option:' + template, this)
        }
        return this
      }
    } else if (el) {
      // 不存在template选项，但是存在el选项的时候，获取el对应元素的outHTML作为template
      template = getOuterHTML(el)
    }
    if (template) {
      /* istanbul ignore if */
      if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
        mark('compile')
      }

      // 将模版变异成函数
      const { render, staticRenderFns } = compileToFunctions(template, {
        shouldDecodeNewlines,
        // 配置解析符号 
        delimiters: options.delimiters
      }, this)
      // 动态添加选项的render和staticRenderFns方法
      options.render = render
      /**
       *  staticRenderFns 数组，这个数组中的函数与 VDOM 中的 diff 算法优化相关，
       * 我们会在编译阶段给后面不会发生变化的 VNode 节点打上 static 为 true 的标签，
       * 那些被标记为静态节点的 VNode 就会单独生成 staticRenderFns 函数：
       */
      options.staticRenderFns = staticRenderFns

      /* istanbul ignore if */
      if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
        // 编译完成
        mark('compile end')
        measure(`${this._name} compile`, 'compile', 'compile end')
      }
    }
  }
  return mount.call(this, el, hydrating)
}

/**
 * Get outerHTML of elements, taking care
 * of SVG elements in IE as well.
 */
function getOuterHTML (el: Element): string {
  if (el.outerHTML) {
    return el.outerHTML
  } else {
    const container = document.createElement('div')
    container.appendChild(el.cloneNode(true))
    return container.innerHTML
  }
}

Vue.compile = compileToFunctions

export default Vue
