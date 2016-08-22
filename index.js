'use strict'
var readonlyProxies = new WeakMap
var currentSandbox = undefined

function compileExpression(src) {
	if (typeof src !== 'string') {
		throw new TypeError('Expected argument to be a string.')
	}
	
	// Can things like this break it?
	// '}).call(this), (function (){return this'
	// compile('}).call(this), (function (){return 2..constructor.constructor("return this")()')({})
	
	// "use strict" does not improve security, it is only added for convenience
	var code = new Function('sandbox', 'with (sandbox) {return (function () {"use strict"; return ' + src + '}).call(this)}')
	
	return function (sandbox) {
		if (!isObject(sandbox)) {
			throw new TypeError('Expected argument to be an object or function.')
		}
		var sandboxProxy = getProxy(sandbox)
		var result
		
		currentSandbox = sandbox
		try {
			result = code.call(sandboxProxy, sandboxProxy)
		} finally {
			currentSandbox = undefined
		}
		return result
	}
}
module.exports = compileExpression

var traps = {
	get: function (target, key, receiver) {
		if (key === Symbol.unscopables && target === currentSandbox) {
			return undefined
		}
		return getProxyOrPrimitive(Reflect.get(target, key, receiver))
	},
	set: function () {
		throw new TypeError('You cannot set properties on a sandboxed object.')
	},
	has: function (target, key) {
		if (target === currentSandbox) {
			return true
		}
		return getProxyOrPrimitive(Reflect.has(target, key))
	},
	getPrototypeOf: function (target) {
		return getProxyOrPrimitive(Reflect.getPrototypeOf(target))
	},
	setPrototypeOf: function () {
		throw new TypeError('You cannot set the prototype of a sandboxed object.')
	},
	isExtensible: function (target) {
		return getProxyOrPrimitive(Reflect.isExtensible(target))
	},
	preventExtensions: function () {
		throw new TypeError('You cannot change the extensibility of a sandboxed object.')
	},
	getOwnPropertyDescriptor: function (target, key) {
		return getProxyOrPrimitive(Reflect.getOwnPropertyDescriptor(target, key))
	},
	defineProperty: function () {
		throw new TypeError('You cannot define properties on a sandboxed object.')
	},
	deleteProperty: function () {
		throw new TypeError('You cannot delete properties on a sandboxed object.')
	},
	apply: function (target, thisArg, argumentsList) {
		if (target === Function || target === eval) {
			throw TypeError('You cannot compile JS code from within a sandboxed environment.')
		}
		return getProxyOrPrimitive(Reflect.apply(target, thisArg, argumentsList))
	},
	construct: function (target, argumentsList, newTarget) {
		if (target === Function) {
			throw TypeError('You cannot compile JS code from within a sandboxed environment.')
		}
		return getProxyOrPrimitive(Reflect.construct(target, argumentsList, newTarget))
	}
}

function isObject(value) {
	return typeof value === 'function' || (value !== null && typeof value === 'object')
}

function getProxyOrPrimitive(value) {
	return isObject(value) ? getProxy(value) : value
}

function getProxy(value) {
	var proxy = readonlyProxies.get(value)
	if (typeof proxy === 'undefined') {
		proxy = new Proxy(value, traps)
		readonlyProxies.set(value, proxy)
	}
	return proxy
}