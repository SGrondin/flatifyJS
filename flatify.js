"v1.1.0";
(function(){
	"use strict";
	var _flatify = function(scope, options){
		var self = this;
		if (!scope){
			if (typeof console === "object" && typeof console.log === "function"){
				console.log("You must pass the 'this' object to the flatify constructor for all features to be available. Ex: new flatify(this);");
			}
			scope = {};
		}
		self.level = 0;
		self.parentInstance = null;
		//Default scope object
		self._scope = {
			"flatify" : {
				"version" : "v1.1.0",
				"masterInstance" : self,
				"currentInstance" : self
			}
		};
		//If the current instance is embedded, use its scope and set the references
		if (scope.flatify && scope.flatify.version === self._scope.flatify.version){
			self._scope = scope;
			self.parentInstance = self._scope.flatify.currentInstance;
			self._scope.flatify.currentInstance = self;
			self.level = self.parentInstance.level + 1;
		}
		
		options = options ? options : {};
		self.defaultOptions = {
			"cont" : (options.cont) ? options.cont : false,
			"wait" : (options.wait || options.wait === false ) ? options.wait : true
		};
		//That way, user jobs can check the active flags
		self.cont = self.defaultOptions.cont;
		self.wait = self.defaultOptions.wait;
		
		self._index = 0;
		self._nextIndex = null;
		self._steps = [];
		self._runCallbackCalled = false;
		self._callback = null;
		self._paused = false;
		self._resume = null;
		
		return self;
	};
	_flatify.prototype.getIndex = function(){
		return this._index;
	};
	_flatify.prototype.setNextIndex = function(nextIndex){
		this._nextIndex = nextIndex;
		return this;
	};
	_flatify.prototype.getNumberJobs = function(){
		return this._steps.length;
	};
	_flatify.prototype.deleteJob = function(pos){
		this._steps.splice(pos, 1);
		return this;
	};
	_flatify.prototype.getContext = function(){
		return this._scope;
	};
	_flatify.prototype.pause = function(){
		if (this._callback !== null){ //Do nothing if run hasn't been called
			this._paused = true;
		}
		return this;
	};
	_flatify.prototype.resume = function(){
		if (this._callback !== null && this._paused){ //Do nothing if run hasn't been called or not paused
			this._paused = false;
			this._resume();
		}
		return this;
	};
	_flatify.prototype.isStarted = function(){
		return !!this._callback;
	};
	_flatify.prototype.isPaused = function(){
		return this._paused;
	};
	_flatify.prototype.isFinished = function(){
		return this._runCallbackCalled;
	};
	_flatify.prototype.seq = function(job, options, pos){
		var self = this;
		if (job){
			options = options ? options : {};
			options = {
				"cont" : (options.cont || options.cont === false) ? options.cont : self.defaultOptions.cont
			};
			var obj = {"job" : job, "par" : false, "options" : options};
			if (pos || pos === 0){
				self._steps.splice(pos, 0, obj);
			}else{
				self._steps.push(obj);
			}
		}
		
		return self;
	};
	_flatify.prototype.par = function(job, options){
		var self = this;
		if (job){
			options = options ? options : {};
			options = {
				"cont" : (options.cont || options.cont === false) ? options.cont : self.defaultOptions.cont,
				"wait" : (options.wait || options.wait === false) ? options.wait : self.defaultOptions.wait,
				"nb"   : options.nb ? options.nb : 1
			};
			//Fill the jobs array
			if (!(job instanceof Array)){
				if (!(options.nb > 0)){
					options.nb = 1;
				}
				var arr = [];
				for (var i=0;i<options.nb;i++){
					arr.push(job);
				}
				job = arr;
			}
			self._steps.push({"job" : job, "par" : true, "options" : options});
		}
		
		return self;
	};
	_flatify.prototype.run = function(callback){
		var self = this;
		if (self._callback === null && typeof callback === "function"){ //Do nothing if run has been called previously
			self._callback = callback;
			if (self._steps.length === 0){
				callback(null);
			}else{
				self._exec(null, []);
			}
		}
		return self;
	};
	_flatify.prototype._exec = function(error, params){
		var self = this;
		//Move up one level if needed
		if (self._scope.flatify.currentInstance._runCallbackCalled){ //If true, scope.flatify.currentInstance needs to be changed
			self._scope.flatify.currentInstance = self._scope.flatify.currentInstance.parentInstance;
		}
		//Check if pausing
		if (self._paused){
			self._resume = (function(error, params){
				return function(){
					self._exec(error, params);
				};
			})(error, params);
		}else{
			//Call either execRun, execSeq or execPar
			if ((error && !self.cont) || self._index === self._steps.length){
				self._execRun(error, params);
			}else{
				var callback = function(error, params){
					if (self._nextIndex !== null && self._steps[self._nextIndex] !== undefined){ //setNextIndex() was called
						self._index = self._nextIndex;
						self._nextIndex = null;
					}else{
						self._index++;
					}
					self._exec(error, params);
				}
				self.cont = self._steps[self._index].options.cont; //Set flag for current job
				if (self._steps[self._index].par){
					self.wait = self._steps[self._index].options.wait;
					self._execPar(error, params, callback);
				}else{
					self._execSeq(error, params, callback);
				}
			}
		}
	};
	_flatify.prototype._execRun = function(error, params){
		var self = this;
		self._runCallbackCalled = true;
		params.unshift(error);
		self._callback.apply(self._scope, params);
	};
	_flatify.prototype._execPar = function(error, params, callback){
		var self = this;
		params.unshift(error);
		var callbackIndex = params.length; //Used to always replace the callback, but keep the same params for all the branches
		var outputs = [];
		var errors = [];
		var errorTrue = false; //At least one job had an error, so return the errors array instead of just null
		var returned = 0;
		var callbackCalled = false;
		var nbSteps = self._steps[self._index].job.length;
		for (var i=0;i<nbSteps;i++){
			outputs[i] = [];
			errors[i] = null;
			params[callbackIndex] = (function(i, index){ //To keep the outputs array ordered the same way the user entered the jobs
				return function(error){
					outputs[i] = Array.prototype.slice.call(arguments, 1);
					errors[i] = error;
					if (error){
						errorTrue = true;
					}
					returned++;
					if ((returned === self._steps[index].job.length || (error && !self.wait)) && !callbackCalled){
						callbackCalled = true;
						if (!errorTrue){
							errors = null;
						}
						callback(errors, [outputs]);
					}
				};
			})(i, self._index);
			self._steps[self._index].job[i].apply(self._scope, params);
		}
	};
	_flatify.prototype._execSeq = function(error, params, callback){
		var self = this;
		params.unshift(error);
		params.push(function(error){
			callback(error, Array.prototype.slice.call(arguments, 1));
		});
		self._steps[self._index].job.apply(self._scope, params);
	};
	
	if (typeof module === "object" && typeof exports === "object"){//Node.js
		exports.flatify = _flatify;
	}else if (typeof window === "object" && window.window === window && typeof window.navigator === "object"){//Browser
		window.flatify = _flatify;
	}
})();
