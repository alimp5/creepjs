export const getOfflineAudioContext = async imports => {

	const {
		require: {
			captureError,
			attempt,
			caniuse,
			sendToTrash,
			documentLie,
			lieProps,
			phantomDarkness,
			logTestResult
		}
	} = imports


	try {
		await new Promise(setTimeout)
		const start = performance.now()
		const win = phantomDarkness ? phantomDarkness : window
		const audioContext = caniuse(() => win.OfflineAudioContext || win.webkitOfflineAudioContext)
		if (!audioContext) {
			logTestResult({ test: 'audio', passed: false })
			return
		}
		// detect lies
		const channelDataLie = lieProps['AudioBuffer.getChannelData']
		const copyFromChannelLie = lieProps['AudioBuffer.copyFromChannel']
		let lied = (channelDataLie || copyFromChannelLie) || false

		const bufferLen = 5000
		const context = new audioContext(1, bufferLen, 44100)
		const analyser = context.createAnalyser()
		const oscillator = context.createOscillator()
		const dynamicsCompressor = context.createDynamicsCompressor()
		const biquadFilter = context.createBiquadFilter()

		// detect lie
		const dataArray = new Float32Array(analyser.frequencyBinCount)
		analyser.getFloatFrequencyData(dataArray)
		const floatFrequencyUniqueDataSize = new Set(dataArray).size
		if (floatFrequencyUniqueDataSize > 1) {
			lied = true
			const floatFrequencyDataLie = `expected -Infinity (silence) and got ${floatFrequencyUniqueDataSize} frequencies`
			documentLie(`AnalyserNode.getFloatFrequencyData`, floatFrequencyDataLie)
		}

		const values = {
			['AnalyserNode.channelCount']: attempt(() => analyser.channelCount),
			['AnalyserNode.channelCountMode']: attempt(() => analyser.channelCountMode),
			['AnalyserNode.channelInterpretation']: attempt(() => analyser.channelInterpretation),
			['AnalyserNode.context.sampleRate']: attempt(() => analyser.context.sampleRate),
			['AnalyserNode.fftSize']: attempt(() => analyser.fftSize),
			['AnalyserNode.frequencyBinCount']: attempt(() => analyser.frequencyBinCount),
			['AnalyserNode.maxDecibels']: attempt(() => analyser.maxDecibels),
			['AnalyserNode.minDecibels']: attempt(() => analyser.minDecibels),
			['AnalyserNode.numberOfInputs']: attempt(() => analyser.numberOfInputs),
			['AnalyserNode.numberOfOutputs']: attempt(() => analyser.numberOfOutputs),
			['AnalyserNode.smoothingTimeConstant']: attempt(() => analyser.smoothingTimeConstant),
			['AnalyserNode.context.listener.forwardX.maxValue']: attempt(() => {
				return caniuse(() => analyser.context.listener.forwardX.maxValue)
			}),
			['BiquadFilterNode.gain.maxValue']: attempt(() => biquadFilter.gain.maxValue),
			['BiquadFilterNode.frequency.defaultValue']: attempt(() => biquadFilter.frequency.defaultValue),
			['BiquadFilterNode.frequency.maxValue']: attempt(() => biquadFilter.frequency.maxValue),
			['DynamicsCompressorNode.attack.defaultValue']: attempt(() => dynamicsCompressor.attack.defaultValue),
			['DynamicsCompressorNode.knee.defaultValue']: attempt(() => dynamicsCompressor.knee.defaultValue),
			['DynamicsCompressorNode.knee.maxValue']: attempt(() => dynamicsCompressor.knee.maxValue),
			['DynamicsCompressorNode.ratio.defaultValue']: attempt(() => dynamicsCompressor.ratio.defaultValue),
			['DynamicsCompressorNode.ratio.maxValue']: attempt(() => dynamicsCompressor.ratio.maxValue),
			['DynamicsCompressorNode.release.defaultValue']: attempt(() => dynamicsCompressor.release.defaultValue),
			['DynamicsCompressorNode.release.maxValue']: attempt(() => dynamicsCompressor.release.maxValue),
			['DynamicsCompressorNode.threshold.defaultValue']: attempt(() => dynamicsCompressor.threshold.defaultValue),
			['DynamicsCompressorNode.threshold.minValue']: attempt(() => dynamicsCompressor.threshold.minValue),
			['OscillatorNode.detune.maxValue']: attempt(() => oscillator.detune.maxValue),
			['OscillatorNode.detune.minValue']: attempt(() => oscillator.detune.minValue),
			['OscillatorNode.frequency.defaultValue']: attempt(() => oscillator.frequency.defaultValue),
			['OscillatorNode.frequency.maxValue']: attempt(() => oscillator.frequency.maxValue),
			['OscillatorNode.frequency.minValue']: attempt(() => oscillator.frequency.minValue)
		}

		const getSum = arr => arr.reduce((acc, curr) => (acc += Math.abs(curr)), 0)

		const getRenderedBuffer = ({
			context,
			floatFrequencyData,
			floatTimeDomainData
		} = {}) => new Promise(resolve => {
			let analyser
			const oscillator = context.createOscillator()
			const dynamicsCompressor = context.createDynamicsCompressor()

			oscillator.type = 'triangle'
			oscillator.frequency.value = 10000

			if (dynamicsCompressor.threshold) { dynamicsCompressor.threshold.value = -50 }
			if (dynamicsCompressor.knee) { dynamicsCompressor.knee.value = 40 }
			if (dynamicsCompressor.ratio) { dynamicsCompressor.ratio.value = 12 }
			if (dynamicsCompressor.reduction) { dynamicsCompressor.reduction.value = -20 }
			if (dynamicsCompressor.attack) { dynamicsCompressor.attack.value = 0 }
			if (dynamicsCompressor.release) { dynamicsCompressor.release.value = 0.25 }

			oscillator.connect(dynamicsCompressor)

			if (floatFrequencyData || floatTimeDomainData) {
				analyser = context.createAnalyser()
				dynamicsCompressor.connect(analyser)
				analyser.connect(context.destination)
			} else {
				dynamicsCompressor.connect(context.destination)
			}

			oscillator.start(0)
			context.startRendering()

			context.oncomplete = event => {
				try {
					if (floatFrequencyData) {
						const data = new Float32Array(analyser.frequencyBinCount)
						analyser.getFloatFrequencyData(data)
						return resolve(data)
					}
					else if (floatTimeDomainData) {
						const data = new Float32Array(analyser.fftSize)
						analyser.getFloatTimeDomainData(data)
						return resolve(data)
					}
					return resolve({
						buffer: event.renderedBuffer,
						compressorGainReduction: dynamicsCompressor.reduction
					})
				}
				catch (error) {
					return resolve()
				}
				finally {
					dynamicsCompressor.disconnect()
					oscillator.disconnect()
				}
			}
		})

		const [
			response,
			floatFrequencyData,
			floatTimeDomainData
		] = await Promise.all([
			getRenderedBuffer({
				context: new audioContext(1, bufferLen, 44100)
			}),
			getRenderedBuffer({
				context: new audioContext(1, bufferLen, 44100),
				floatFrequencyData: true
			}),
			getRenderedBuffer({
				context: new audioContext(1, bufferLen, 44100),
				floatTimeDomainData: true
			})
		])
		const { buffer, compressorGainReduction } = response
    	const floatFrequencyDataSum = getSum(floatFrequencyData)
		const floatTimeDomainDataSum = getSum(floatTimeDomainData)

		const copy = new Float32Array(bufferLen)
		caniuse(() => buffer.copyFromChannel(copy, 0))
		const bins = buffer.getChannelData(0)
		const copySample = [...copy].slice(4500, 4600)
		const binsSample = [...bins].slice(4500, 4600)
		const sampleSum = getSum([...bins].slice(4500, bufferLen))
		
		// detect lies

		// sample matching
		const matching = '' + binsSample == '' + copySample
		const copyFromChannelSupported = ('copyFromChannel' in AudioBuffer.prototype)
		if (copyFromChannelSupported && !matching) {
			lied = true
			const audioSampleLie = 'getChannelData and copyFromChannel samples mismatch'
			documentLie('AudioBuffer', audioSampleLie)
		}

		// sample uniqueness
		const totalUniqueSamples = new Set([...bins]).size
		if (totalUniqueSamples == bufferLen) {
			const audioUniquenessTrash = `${totalUniqueSamples} unique samples of ${bufferLen} is too high`
			sendToTrash('AudioBuffer', audioUniquenessTrash)
		}

		// sample noise factor
		const getNoiseFactor = () => {
			const buffer = new AudioBuffer({
				length: 1,
				sampleRate: 44100
			})
			buffer.getChannelData(0)[0] = 1
			return buffer.getChannelData(0)[0]
		}
		const noiseFactor = getNoiseFactor()
		const noise = noiseFactor == 1 ? 0 : noiseFactor
		if (noise) {
			lied = true
			const audioSampleNoiseLie = 'sample noise detected'
			documentLie('AudioBuffer', audioSampleNoiseLie)
		}

		logTestResult({ start, test: 'audio', passed: true })
		return {
			totalUniqueSamples,
			compressorGainReduction,
			floatFrequencyDataSum,
			floatTimeDomainDataSum,
			sampleSum,
			binsSample,
			copySample: copyFromChannelSupported ? copySample : [undefined],
			values,
			noise,
			lied
		}
			
	}
	catch (error) {
		logTestResult({ test: 'audio', passed: false })
		captureError(error, 'OfflineAudioContext failed or blocked by client')
		return
	}

}