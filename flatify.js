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
		self._runCallbackCalled = false;
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
		self._steps = [];
		self._callback = function(){};
		
		return self;
	};
	_flatify.prototype.getIndex = function(){
		var self = this;
		return self._index;
	};
	_flatify.prototype.getNumberJobs = function(){
		var self = this;
		return self._steps.length;
	};
	_flatify.prototype.deleteJob = function(pos){
		var self = this;
		self._steps.splice(pos, 1);
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
		self._callback = callback;
		if (self._steps.length === 0){
			callback(null);
		}else{
			self._exec(null, []);
		}
		return self;
	};
	_flatify.prototype._exec = function(error, params){
		var self = this;
		//Move up one level if needed
		if (self._scope.flatify.currentInstance._runCallbackCalled){
			self._scope.flatify.currentInstance = self._scope.flatify.currentInstance.parentInstance;
		}
		//Call the right function on the job
		if ((error && !self.cont) || self._index === self._steps.length){
			self._execRun(error, params);
		}else{
			self.cont = self._steps[self._index].options.cont; //Set flag for current job
			if (self._steps[self._index].par){
				self.wait = self._steps[self._index].options.wait;
				self._execPar(error, params, function(error, params){
					self._index++;
					self._exec(error, params);
				});
			}else{
				self._execSeq(error, params, function(error, params){
					self._index++;
					self._exec(error, params);
				});
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
