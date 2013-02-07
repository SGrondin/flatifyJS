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
	strictEqual : function(param1, param2){
		nbAsserts++;
		if (param1 !== param2){
			var error = "ASSERT FAIL. "+param1+" !== "+param2;
			output(error);
			throw error;
		}else{
			output(param1+" === "+param2);
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

//Test index
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
	console.log("OK  "+nbAsserts+" asserts");
}, 2200);
