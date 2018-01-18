// 给纯函数添加缓存
function cached(fn) {
    const cache = Object.create(null)
    return (function cachedFn(str) {
        const hit = cache[str]
        return hit || (cache[str] = fn(str))
    })
}

// 严格对象类型检查
const toString = Object.prototype.toString
const OBJECT_STRING = '[object Object]'
export function isPlainObject (obj) {
  return toString.call(obj) === OBJECT_STRING
}

// 转hello-world为helloWorld
const camelizeRE = /-(\w)/g
export const camelize = cached((str) => {
  return str.replace(camelizeRE, (_, c) => c ? c.toUpperCase() : '')
})
