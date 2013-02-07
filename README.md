# flatifyJS

Flatify is a simple, recursive and powerful dynamic flow management library for asynchronous Javascript and Node.JS. It was built to make callback heavy code, modular easy to read, write and maintain; in other words, to avoid going to [Callback Hell](http://www.google.com/search?q=callback+hell). Compared to the popular [async](https://github.com/caolan/async) and [step](https://github.com/creationix/step) libraries, flatify offer much more advanced fine tuning for concurrency features and dynamic flow execution, but none of Async's collections and other utilities.

## Basic features

Flatify works by building a queue of ordered jobs.
Suppose you have 3 HTTP calls to make, but each call needs the result of the previous one.

### .seq(job)
```javascript
var callA = function(error, callback){
  makeHTTPcall( ... , function(result){
		callback(null, result);
	});
};
var callB = function(error, resultA, callback){ ... };
var callC = function(error, resultB, callback){ ... };

new flatify(this).seq(callA).seq(callB).seq(callC).run(function(error, resultC){
	//do something with resultC
});
```
The seq() method adds a job to the end of the jobs queue. Once run() is called, every job in the queue is run in a sequential order.
But now suppose that callA and callB can be made in parallel and that callC can only be made once both callA and callB have completed:

### .par(jobs)

```javascript
var callA = function(error, callback){ ... }
var callB = function(error, callback){ ... }
var callC = function(error, results, callback){ ... }

new flatify(this).par([callA, callB]).seq(callC).run(function(error, resultC){
	//do something with resultC
});
```

Flatify makes it easy to organize asynchronous code in a simple and beautiful way, but the real power of flatify is documented in the Advanced Features section.

## Installation

__Node.JS__
Simply place the flatify.js file in your project folder and include it:
```javascript
var flatify = require(__dirname + "/flatify.js").flatify;
```
__Browser__
Just import it!
```html
<script src="flatify.js" type="text/javascript"></script>
```

## Methods

Every method that doesn't return a value returns "this" to make calls chainable.

### .seq(job, options, index)

Options and index are optional.
Add the job at the specified index in the jobs queue, end of the queue by default.

__Job__ function that conforms to Node.JS's standard arguments format: function(error, param1, param2, param3, ..., callback)

__Options__: object.
Key:
* "cont" (boolean). If set to true, the next job in the job queue will be called even if the current job returned an error. By default, returning an error will cause flatify to jump to the run() callback.

__Index__ Index in the job queue to add. By default, the job will be added to the end of the queue.

### .par(jobs, options, index)

Options and index are optional.
Add multiple jobs to be executed in parallel. The next job in the queue will be called once all these parallel jobs have completed. If one of them returns an error, the next job in the queue is called immediately unless the "wait" option is set to true.

__Jobs__: An array of jobs OR a single function (not in an array). For the latter, make sure to specify the "nb" option.

__Options__: object.
Keys:
* "cont" (boolean). Same as for seq().
* "nb" (integer). If Jobs is a single function, "nb" is the number of times it must be run in parallel. Default is 1.
* "wait" (boolean). If set to true and one of the parallel jobs returns an error, flatify will wait for all jobs to complete before continuing.

__Index__: Same as previously.

### .run(job)

Flatify starts going through the job queue.

__Job__: this is the final job, it will be called once flatify has reached the end of the queue. It is mandatory.

### .getIndex()

Returns the current job queue index.

### .setNextIndex(index)

Sets the job queue index. After the current job finishes, the queue will continue at that index. Warning: it's easy to create infinite loops by backtracking without checks. Read the Advanced Features section for more information.

### .getNumberJobs()

Returns the number of jobs in the job queue.

### .deleteJob(index)

Removes the job at the specified index. To add a job at a specific index, use the seq() and par() methods. Read the Advanced Features section for more information.

### .getContext()

Returns the internal execution context. Read the Advanced Features section for more information.

### .pause()

The current job will finish, but the next one won't be called. If the curent job was the last one in the queue, the "exit job" (the one supplied to the run() method) will be called.

### .resume()

Resumes execution after calling pause().

### .isStarted()

Returns true if run() has been called, false otherwise.

### .isPaused()

Returns true if pause() has been called, false otherwise.

### .isFinished()

Returns true if the "exit job" (the run() one) has been called.


## Advanced features

### Default options

The default "cont" and "wait" options (false and true, respectively) can be overriden

```javascript
new flatify(this, {"cont":true, "wait":false}).par(
	function(){ ... } //Here "cont" is true and "wait" is false
).par(
	function(){ ... }, {"cont":false} //Here both "cont" and "wait" are false.
).run( ... );
```

### Recursion

Suppose you want to make 2 HTTP calls sequentially: callA, then callB.
```javascript
new flatify(this).seq(callA).seq(callB).run(function(error, result){
	//do something with result
});
```
... except that you want to do the above 4 times in parallel:
```javascript
new flatify(this).par(function(error, callback){
	new flatify(this).seq(callA).seq(callB).run(function(error, result){
		callback(null, result);
	});
}, {"nb":4}).run(function(error, results){
	//Here results is an array containing 4 results,
	//1 from each individual parallel job (each one made from 2 sequential jobs)
});
```
By embedding flatify objects recursively, it becomes possible to easily design complex operations.

### Shared context

A flatify object is made of only one context, which allows parallel jobs to share data. In other words, at any point in the jobs queue, the 'this' object refers to the same unique object.
```javascript
new flatify(this).seq(function(error, callback){
	this.test1 = "ABC";
	this.test2 = [];
	this.test3 = 1;
	callback(null);
}).par(function(error, callback){
	this.test2.push(this.test3++);
	callback(null);
}, {"nb":5}).run(function(error){
	console.log(this.test1); //Outputs "ABC"
	console.log(this.test2); //Outputs [1,2,3,4,5]
});
```
It also works recursively!
```javascript
new flatify(this).seq(function(error, callback){
	this.test1 = "ABC";
	new flatify(this).seq(function(error, callback){
		console.log(this.test1); //Outputs "ABC"
		this.test2 = "DEF";
		callback(null);
	}).run(function(error){
		callback(null);
	});
}).run(function(error){
	console.log(this.test1); //Outputs "ABC"
	console.log(this.test2); //Outputs "DEF"
});
```

### Dynamic

The flatify object can be accessed and modified during execution. The shared context contains a "flatify" object with the following structure:

__this.flatify object__
* currentInstance. Refers to the flatify instance that is currently running.
* masterInstance. Refers to the TOP flatify instance. It is the same instance as currentInstance unless the currentInstance is embedded within a flatify instance.

__Any flatify instance__

Apart from the methods described in the Methods section, a flatify instance also contains the following properties:
* level. Depth level. The top flatify instance has a level of 0. An instance within an instance within an instance has a level of 2.
* parentInstance. A reference to the instance one level higher, null if the currentInstance is the top instance.
* defaultOptions. See the Default Options section for more information
* cont. The "cont" setting for the current job.
* wait. The "wait" setting for the current job.

The methods and properties beginning with an underscore are for internal use.

```javascript
new flatify(this, {"cont":true}).seq(function(error, callback){
	this.flatify.currentInstance.deleteJob(this.flatify.currentInstance.getIndex()+1);
	callback("error 1");
}).seq(function(error, callback){
	callback("error 2");
}).seq(function(error, callback){
	console.log(error); //Outputs "error 1"
	callback("error 3");
}).run(function(error){
	console.log(error); //Ouputs "error 3"
});
//The second job was never called because it was deleted by the first job.
```
More examples can be found in the tests/testflatify.js file.
=======
# flatifyJS

Flatify is a simple, recursive and powerful dynamic flow management library for asynchronous Javascript and Node.JS. It was built to make callback heavy code modular, easy to read, write and maintain; in other words, to avoid going to [Callback Hell](http://elm-lang.org/learn/Escape-from-Callback-Hell.elm). Compared to the popular [Async](https://github.com/caolan/async) library, flatify has much more advanced fine tuning for concurrency features, but none of Async's collections and other utilities.

## Basic features

Flatify works by building a queue of ordered jobs.
Suppose you have 3 HTTP calls to make, but each call needs the result of the previous one.

### .seq(job)
```javascript
var callA = function(error, callback){
	makeHTTPcall( ... , function(httpError, result){
		callback(null, result); //As per Node's standard, the first parameter is the error
	});
};
var callB = function(error, resultA, callback){ ... };
var callC = function(error, resultB, callback){ ... };

new flatify(this).seq(callA).seq(callB).seq(callC).run(function(error, resultC){
	//do something with resultC
});
```
The seq() method adds a job to the end of the jobs queue. Once run() is called, every job in the queue is run in a sequential order.
But now suppose that callA and callB can be made in parallel and that callC can only be made once both callA and callB have completed:

### .par(jobs)

```javascript
var callA = function(error, callback){ ... }
var callB = function(error, callback){ ... }
var callC = function(error, results, callback){ ... }

new flatify(this).par([callA, callB]).seq(callC).run(function(error, resultC){
	//do something with resultC
});
```

Flatify makes it easy to organize asynchronous code in a simple and beautiful way, but its real power is documented in the Advanced Features section.

## Installation

__Node.JS__
Simply place the flatify.js file in your project folder and include it:
```javascript
var flatify = require(__dirname + "/flatify.js").flatify;
```
__Browser__
Just import it!
```html
<script src="flatify.js" type="text/javascript"></script>
```

## Methods

### .seq(job, options, index)

Options and index are optional.
Add the job at the specified index in the jobs queue, end of the queue by default.

__Job__ function that conforms to Node.JS's standard arguments format: function(error, param1, param2, param3, ..., callback)

__Options__: object.
Key:
* "cont" (boolean). If set to true, the next job in the job queue will be called even if the current job returned an error. By default, returning an error will cause flatify to jump to the run() callback.

__Index__ Index in the job queue to add. By default, the job will be added to the end of the queue.

### .par(jobs, options, index)

Options and index are optional.
Add multiple jobs to be executed in parallel. The next job in the queue will be called once all these parallel jobs have completed. If one of them returns an error, the next job in the queue is called immediately unless the "wait" option is set to true.

__Jobs__: An array of jobs OR a single function (not in an array). For the latter, make sure to specify the "nb" option.

__Options__: object.
Keys:
* "cont" (boolean). Same as for seq().
* "nb" (integer). If Jobs is a single function, "nb" is the number of times it must be run in parallel. Default is 1.
* "wait" (boolean). If set to true and one of the parallel jobs returns an error, flatify will wait for all jobs to complete before continuing.

__Index__ Same as previously.

### .run(job)

Flatify starts going through the job queue.

__Job__: this is the final job and will be called once Flatify has gone through the whole queue. It is mandatory.

### .getIndex()

Returns the current job queue index.

### .getNumberJobs()

Returns the number of jobs in the job queue.

### .deleteJob(index)

Removes the job at the specified index.

## Advanced features

### Default options

The default "cont" and "wait" options (false and true, respectively) can be overriden like so:

```javascript
var callA = function( ... ){ ... };
var callB = function( ... ){ ... };

new flatify(this, {"cont":true, "wait":false} //Default options go here
).par(callA, {"nb":4} //For callA, "cont" is true and "wait" is false
).par(callB, {"nb":4, "cont":false} //For callB, both "cont" and "wait" are false
).run( ... );
```

### Recursion

Suppose you want to make 2 HTTP calls sequentially: callA, then callB.
```javascript
new flatify(this).seq(callA).seq(callB).run(function(error, result){
	//do something with result
});
```
... except that you want to do the above 4 times in parallel:
```javascript
new flatify(this).par(function(error, callback){
	new flatify(this).seq(callA).seq(callB).run(function(error, result){
		callback(null, result);
	});
}, {"nb":4}).run(function(error, results){
	//Here results is an array containing 4 results,
	//1 from each individual parallel job (each one made from 2 sequential jobs)
});
```
By embedding flatify objects recursively, it becomes possible to easily design complex operations.

### Shared context

A flatify object is made of only one context, which allows parallel jobs to share data. In other words, at any point in the jobs queue, the 'this' object refers to the same unique object.
```javascript
new flatify(this).seq(function(error, callback){
	this.test1 = "ABC";
	this.test2 = [];
	this.test3 = 1;
	callback(null);
}).par(function(error, callback){
	this.test2.push(this.test3++);
	callback(null);
}, {"nb":5}).run(function(error){
	console.log(this.test1); //Outputs "ABC"
	console.log(this.test2); //Outputs [1,2,3,4,5]
});
```
It also works recursively!
```javascript
new flatify(this).seq(function(error, callback){
	this.test1 = "ABC";
	new flatify(this).seq(function(error, callback){
		console.log(this.test1); //Outputs "ABC"
		this.test2 = "DEF";
		callback(null);
	}).run(function(error){
		callback(null);
	});
}).run(function(error){
	console.log(this.test1); //Outputs "ABC"
	console.log(this.test1); //Outputs "DEF"
});
```

### Dynamic

The flatify object can be accessed and modified during execution. The shared context contains a "flatify" object with the following structure:

__this.flatify object__
* currentInstance. Refers to the flatify instance that is currently running.
* masterInstance. Refers to the TOP flatify instance. It is the same instance as currentInstance unless the currentInstance is embedded within a flatify instance.

__Any flatify instance__

Apart from the methods described in the Methods section, a flatify instance also contains the following properties:
* level. Depth level. The top flatify instance has a level of 0. An instance within an instance within an instance has a level of 2.
* parentInstance. A reference to the instance one level higher, null if the currentInstance is the top instance.
* defaultOptions. See the Default Options section for more information
* cont. The "cont" setting for the current job.
* wait. The "wait" setting for the current job.

The methods and properties beginning with an underscore are for internal use.

```javascript
new flatify(this, {"cont":true}).seq(function(error, callback){
	this.flatify.currentInstance.deleteJob(this.flatify.currentInstance.getIndex()+1);
	callback("error 1");
}).seq(function(error, callback){
	callback("error 2");
}).seq(function(error, callback){
	console.log(error); //Outputs "error 1"
	callback("error 3");
}).run(function(error){
	console.log(error); //Ouputs "error 3"
});
//The second job was never called because it was deleted by the first job.
```
