const obj = Object.create(null)
const config = {
    a: 1,
    b: 2,
    c: 3
}
const configDef = {} 
configDef.get = () => config
configDef.set = () => {
    console.warn('不能覆盖属性')
}

Object.defineProperty(obj,'config',configDef)

console.log(obj['config']['a'])

obj['config'] = {}

