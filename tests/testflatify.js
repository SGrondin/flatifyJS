var isNode = (typeof module === "object" && typeof exports === "object");
var isBrowser = (typeof window === "object" && window.window === window && typeof window.navigator === "object");
var consoleExists = (typeof console !== "undefined" && typeof console.log === "function");

var output = function(str){
	if (consoleExists){
		console.log(str);
	}
	if (isBrowser){
		document.write(str+"<br />");
	}
};
var nbAsserts = 0;
var assert = {
	strictEqual : function(param1, param2, display){
		nbAsserts++;
		if (param1 !== param2){
			var error = "ASSERT FAIL. "+param1+" !== "+param2;
			output(error);
			throw error;
		}else{
			if (display){
				output(param1+" === "+param2);
			}
		}
	}
};


if (isNode){
	var util = require("util");
	global.con = function(variable){
		util.puts(util.inspect(variable));
	};
	var flatify = require(__dirname + "/../flatify.js").flatify;

}else if (isBrowser){
	if (consoleExists){
		window.con = function(obj){console.log(obj);};
	}else{
		window.con = function(obj){};
	}
}

var timer = 1500;
var t = new flatify(this, {"cont" : true}).seq(function(error, callback){
	this.abc = "Shared context test";
	this.def = 0;
	new flatify(this).seq(function(error, callback){
		assert.strictEqual(this.flatify.currentInstance.level, 1);
		callback(null, "Sequential parameter passing test");
	}).run(function(error, param){
		assert.strictEqual(param, "Sequential parameter passing test");
		
		new flatify(this).par([function(error, callback){
			assert.strictEqual(this.flatify.currentInstance.level, 2);
			callback(null, "From #0a", "From #0b");
		}, function(error, callback){
			assert.strictEqual(this.abc, "Shared context test");
			callback("Branch #1 error", "From #1");
		}]).run(function(error, param){
			assert.strictEqual(error[0], null);
			assert.strictEqual(error[1], "Branch #1 error");
			assert.strictEqual(param[0][0], "From #0a");
			assert.strictEqual(param[0][1], "From #0b");
			assert.strictEqual(param[1][0], "From #1");
			callback(null, "Level ("+this.flatify.currentInstance.level+") up parameter passing test");
		});
	});
}).par(function(error, param, callback){
	var self = this;
	setTimeout(function(){
		assert.strictEqual(param, "Level (2) up parameter passing test");
		assert.strictEqual(self.abc, "Shared context test");
		assert.strictEqual(self.flatify.currentInstance.level, 1);
		callback((self.def === 2 ? "TEST ERROR" : null), "From #"+(self.def++), self.abc);
	}, (timer-=250));
}, {"nb":4}).run(function(error, param){
	assert.strictEqual(error[0], null);
	assert.strictEqual(error[1], "TEST ERROR");
	assert.strictEqual(error[2], null);
	assert.strictEqual(error[3], null);
	assert.strictEqual(param[0][0], "From #3");
	assert.strictEqual(param[1][0], "From #2");
	assert.strictEqual(param[2][0], "From #1");
	assert.strictEqual(param[3][0], "From #0");
});

//Test empty queue
var testRun = "";
new flatify(this).run(function(error){
	testRun += "!";
});
assert.strictEqual(testRun, "!");

//Test wait
var a = function(errors, param){
	assert.strictEqual(errors[0], null);
	assert.strictEqual(errors[1], "!!!");
	assert.strictEqual(param[0].length, 0);
	assert.strictEqual(param[1][0], "param 2");
};
var b = function(error, callback){
	setTimeout(function(){
		callback(null,"param 1");
	}, 1500);
};
var d = function(error, callback){
	callback(null);
};
var c = function(error, callback){
	callback(null);
};

new flatify(this, {"wait":true}).par([b, function(error, callback){
	new flatify(this).seq(d).seq(c).run(function(error){
		callback("!!!", "param 2");
	});
}], {"wait":false}).run(a);

// Test cont
new flatify(this, {"cont":true}).seq(function(error, callback){
	assert.strictEqual(error, null);
	callback("!!!");
}, {"cont":false}).seq(function(error, callback){
	assert.strictEqual(true, false);
	callback(null);
}).run(function(error){
	assert.strictEqual(error, "!!!");
});

//Test getIndex
new flatify(this, {"cont":true}).seq(function(error, callback){
	this.flatify.currentInstance.seq(function(error, callback){
		assert.strictEqual(error, "error 1");
		callback("error 2");
	}, null, this.flatify.currentInstance.getIndex()+1);
	callback("error 1");
}).seq(function(error, callback){
	assert.strictEqual(error, "error 2");
	callback("error 3");
}).run(function(error){
	assert.strictEqual(error, "error 3");
});

//Test setIndex
new flatify(this).seq(function(error, callback){
	if (!this.reset){
		this.reset = false;
		this.nbSeq = 0;
	}
	this.nbSeq++;
	callback(null);
}).seq(function(error, callback){
	this.nbSeq++;
	callback(null);
}).seq(function(error, callback){
	this.nbSeq++;
	if (!this.reset){
		this.reset = true;
		this.flatify.currentInstance.setNextIndex(0);
	}
	callback(null);
}).run(function(error){
	assert.strictEqual(this.nbSeq, 6);
});

//Delete job
new flatify(this, {"cont":true}).seq(function(error, callback){
	this.flatify.currentInstance.deleteJob(this.flatify.currentInstance.getIndex()+1);
	callback("error 1");
}).seq(function(error, callback){
	callback("error 2");
}).seq(function(error, callback){
	assert.strictEqual(error, "error 1");
	callback("error 3");
}).run(function(error){
	assert.strictEqual(error, "error 3");
});

//Test getContext, pause/resume, isFinished, isPaused, invalid pause/resume/run

var instance = new flatify(this).seq(function(error, callback){
	var context = this;
	setTimeout(function(){
		context.i = 1;
		callback(null);
	}, 100);
}).seq(function(error, callback){
	var context = this;
	setTimeout(function(){
		context.i++;
		callback(null);
	}, 100);
}).seq(function(error, callback){
	var context = this;
	setTimeout(function(){
		context.i++;
		callback(null);
	}, 100);
}).seq(function(error, callback){
	var context = this;
	setTimeout(function(){
		context.i++;
		callback(null);
	}, 100);
});

assert.strictEqual(instance.isStarted(), false);
assert.strictEqual(instance.isPaused(), false);
assert.strictEqual(instance.isFinished(), false);
instance.resume(); //Useless resume
assert.strictEqual(instance.isStarted(), false);
assert.strictEqual(instance.isPaused(), false);
assert.strictEqual(instance.isFinished(), false);
instance.pause(); //Useless Pause
assert.strictEqual(instance.isStarted(), false);
assert.strictEqual(instance.isPaused(), false);
assert.strictEqual(instance.isFinished(), false);
instance.resume(); //Useless resume
assert.strictEqual(instance.isStarted(), false);
assert.strictEqual(instance.isPaused(), false);
assert.strictEqual(instance.isFinished(), false);
instance.run(function(error){
	assert.strictEqual(this.i, 4);
});
assert.strictEqual(instance.isStarted(), true);
assert.strictEqual(instance.isPaused(), false);
assert.strictEqual(instance.isFinished(), false);


setTimeout(function(){
	instance.resume(); //Useless resume
	assert.strictEqual(instance.isStarted(), true);
	assert.strictEqual(instance.isPaused(), false);
	assert.strictEqual(instance.isFinished(), false);
	instance.pause(); //PAUSE
	assert.strictEqual(instance.isStarted(), true);
	assert.strictEqual(instance.isPaused(), true);
	assert.strictEqual(instance.isFinished(), false);
	assert.strictEqual(instance.getContext().i, 2);
	setTimeout(function(){
		instance.resume(); //RESUME
		assert.strictEqual(instance.isStarted(), true);
		assert.strictEqual(instance.isPaused(), false);
		assert.strictEqual(instance.isFinished(), false);
		setTimeout(function(){
			assert.strictEqual(instance.getContext().i, 4);
			assert.strictEqual(instance.isStarted(), true);
			assert.strictEqual(instance.isPaused(), false);
			assert.strictEqual(instance.isFinished(), true);
		}, 1000);
	}, 1000);
}, 220);


//DOCUMENTATION EXAMPLES
new flatify(this).seq(function(error, callback){
	this.test1 = "ABC";
	this.test2 = [];
	this.test3 = 1;
	callback(null);
}).par(function(error, callback){
	this.test2.push(this.test3++);
	callback(null);
}, {"nb":5}).run(function(error){
	assert.strictEqual(this.test1, "ABC");
	assert.strictEqual(this.test2[0], 1);
	assert.strictEqual(this.test2[1], 2);
	assert.strictEqual(this.test2[2], 3);
	assert.strictEqual(this.test2[3], 4);
	assert.strictEqual(this.test2[4], 5);
});

new flatify(this).seq(function(error, callback){
	this.test1 = "ABC";
	new flatify(this).seq(function(error, callback){
		assert.strictEqual(this.test1, "ABC");
		this.test2 = "DEF";
		callback(null);
	}).run(function(error){
		callback(null);
	});
}).run(function(error){
	assert.strictEqual(this.test1, "ABC");
	assert.strictEqual(this.test2, "DEF");
});


setTimeout(function(){
	console.log("OK  "+nbAsserts+" asserts passed");
}, 5000);
