const Assert = require('assert-plus')
const { fetchProp: p } = require('fetch-prop')


function datadogTracingPlugin(opts = {}) {
	const seneca = this

	const getTracer = p(opts, 'getTracer', Assert.func)
	const dd_tracer = getTracer()


	seneca.order.inward.add(spec => {
		const func = p(spec, ['ctx', 'actdef', 'func'])


		if (!spec.ctx.actdef.func.__wrapper$) {
			func.__wrapper$ = spec => {
				const pattern = p(spec, ['data', 'meta', 'pattern'])

				// NOTE: msgcanon is the pattern, except represented as an Object.
				//
				const msgcanon = p(spec, ['ctx', 'actdef', 'msgcanon'])

				return function (...args) {
					const seneca = this


					const reply = args[1]
					Assert.func(reply, 'reply')


					// TODO: Remove this assertion once it is confirmed that this case may never happen.
					//
					Assert(!('__is_wrapped$' in reply), "did not expect to receive a reply that's already wrapped")

					const wrapReply = endSpan => {
						const datadogTracedReply = function (...args) {
							const err = args.length > 0 ? args[0] : null
							endSpan(err)

							return reply.apply(this, args)
						}

						// TODO: Remove this assertion once it is confirmed that this case may never happen.
						//
						datadogTracedReply.__is_wrapped$ = true

						return datadogTracedReply
					}


					dd_tracer.trace(pattern, (span, endSpan) => {
						// NOTE: Adding tags makes filtering in the Datadog UI possible.
						//
						span.addTags({ pattern: msgcanon })

						args[1] = wrapReply(endSpan)

						return func.apply(seneca, args)
					})
				}
			}
		}

		spec.ctx.actdef.func = func.__wrapper$(spec)
		spec.ctx.actdef.func.__wrapper$ = func.__wrapper$
	})
}


module.exports = datadogTracingPlugin
