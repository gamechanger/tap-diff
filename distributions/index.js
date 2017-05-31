'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _chalk = require('chalk');

var _chalk2 = _interopRequireDefault(_chalk);

var _duplexer = require('duplexer');

var _duplexer2 = _interopRequireDefault(_duplexer);

var _figures = require('figures');

var _figures2 = _interopRequireDefault(_figures);

var _through2 = require('through2');

var _through22 = _interopRequireDefault(_through2);

var _tapParser = require('tap-parser');

var _tapParser2 = _interopRequireDefault(_tapParser);

var _prettyMs = require('pretty-ms');

var _prettyMs2 = _interopRequireDefault(_prettyMs);

var _getSource = require('get-source');

var _getSource2 = _interopRequireDefault(_getSource);

var _difflet = require('difflet');

var _difflet2 = _interopRequireDefault(_difflet);

var _ansidiff = require('ansidiff');

var _ansidiff2 = _interopRequireDefault(_ansidiff);

var diff = (0, _difflet2['default'])({ indent: 4 });

var INDENT = '  ';
var FIG_TICK = _figures2['default'].tick;
var FIG_CROSS = _figures2['default'].cross;

var createReporter = function createReporter() {
  var output = (0, _through22['default'])();
  var p = (0, _tapParser2['default'])();
  var stream = (0, _duplexer2['default'])(p, output);
  var startedAt = Date.now();

  var println = function println() {
    var input = arguments.length <= 0 || arguments[0] === undefined ? '' : arguments[0];
    var indentLevel = arguments.length <= 1 || arguments[1] === undefined ? 0 : arguments[1];

    var indent = '';

    for (var i = 0; i < indentLevel; ++i) {
      indent += INDENT;
    }

    input.split('\n').forEach(function (line) {
      output.push('' + indent + line);
      output.push('\n');
    });
  };

  var handleTest = function handleTest(name) {
    println();
    println(_chalk2['default'].blue(name), 1);
  };

  var handleAssertSuccess = function handleAssertSuccess(assert) {
    var name = assert.name;

    println(_chalk2['default'].green(FIG_TICK) + '  ' + _chalk2['default'].dim(name), 2);
  };

  var toString = function toString(arg) {
    return Object.prototype.toString.call(arg).slice(8, -1).toLowerCase();
  };

  var JSONize = function JSONize(str) {
    return str
    // wrap keys without quote with valid double quote
    .replace(/([\$\w]+)\s*:/g, function (_, $1) {
      return '"' + $1 + '": ';
    })
    // replacing single quote wrapped ones to double quote
    .replace(/'([^']+)'/g, function (_, $1) {
      return '"' + $1 + '"';
    });
  };

  var objectize = function objectize(arg) {
    if (typeof arg === 'string') {
      try {
        // the assert event only returns strings which is broken so this
        // handles converting strings into objects
        if (arg.indexOf('{') > -1) {
          arg = JSON.parse(JSONize(arg));
        }
      } catch (e) {
        try {
          arg = eval('(' + arg + ')');
        } catch (e) {
          // do nothing because it wasn't a valid json object
        }
      }
    }
    return arg;
  };

  var handleAssertFailure = function handleAssertFailure(assert) {
    var name = assert.name;

    var _assert$diag = assert.diag;
    var at = _assert$diag.at;
    var actual = _assert$diag.actual;
    var expected = _assert$diag.expected;

    at = processSourceMap(at);

    println(_chalk2['default'].red(FIG_CROSS) + '  ' + _chalk2['default'].red(name) + ' at ' + _chalk2['default'].magenta(at), 2);

    try {

      actual = objectize(actual);
      expected = objectize(expected);

      var str = '';
      if (actual && expected) {
        if (typeof expected !== typeof actual || typeof expected === 'object' && (!actual || !expected)) {
          str = _chalk2['default'].grey('Expected ') + _chalk2['default'].white(typeof expected) + _chalk2['default'].grey(' but got ') + _chalk2['default'].white(typeof actual);
        } else if (typeof expected === 'string') {
          if (str.indexOf('\n') >= 0) {
            str = _ansidiff2['default'].lines(expected, actual);
          } else {
            str = _ansidiff2['default'].chars(expected, actual);
          }
        } else if (typeof expected === 'object') {
          str = diff.compare(expected, actual);
        } else {
          str = _chalk2['default'].grey('Expected ') + _chalk2['default'].white('' + expected) + _chalk2['default'].grey(' but got ') + _chalk2['default'].white('' + actual);
        }
      }
      if (str != '') {
        str.replace(/\n/g, '\n      ');
        output.push(str);
      }
      println();
    } catch (e) {
      console.log(e);
    }
  };

  var processSourceMap = function processSourceMap(at) {
    var re = /\((.*)\:(\d*)\:(\d*)\)$/;
    var parsed = at.match(re);
    var file = parsed[1];
    var line = Number(parsed[2]);
    var column = Number(parsed[3]);

    var sourceFile = (0, _getSource2['default'])(file);
    var resolved = sourceFile.resolve({ line: line, column: column });

    return at.replace(re, '(' + resolved.sourceFile.path + ':' + resolved.line + ':' + resolved.column + ')');
  };

  var handleComplete = function handleComplete(result) {
    var finishedAt = Date.now();

    println();
    println(_chalk2['default'].green('passed: ' + result.pass + '  ') + _chalk2['default'].red('failed: ' + (result.fail || 0) + '  ') + _chalk2['default'].white('of ' + result.count + ' tests  ') + _chalk2['default'].dim('(' + (0, _prettyMs2['default'])(finishedAt - startedAt) + ')'));
    println();

    if (result.ok) {
      println(_chalk2['default'].green('All of ' + result.count + ' tests passed!'));
      println();
    } else {
      println(_chalk2['default'].red((result.fail || 0) + ' of ' + result.count + ' tests failed.'));
      println();
      stream.isFailed = true;
      println(_chalk2['default'].red('FAILURES:'));

      for (var i = result.failures.length - 1; i >= 0; i--) {
        println();
        handleAssertFailure(result.failures[i]);
      }

      println();
    }
  };

  p.on('comment', function (comment) {
    var trimmed = comment.replace('# ', '').trim();

    if (/^tests\s+[0-9]+$/.test(trimmed)) return;
    if (/^pass\s+[0-9]+$/.test(trimmed)) return;
    if (/^fail\s+[0-9]+$/.test(trimmed)) return;
    if (/^ok$/.test(trimmed)) return;

    handleTest(trimmed);
  });

  p.on('assert', function (assert) {
    if (assert.ok) return handleAssertSuccess(assert);

    handleAssertFailure(assert);
  });

  p.on('complete', handleComplete);

  p.on('child', function (child) {
    ;
  });

  p.on('extra', function (extra) {
    println(_chalk2['default'].yellow(('' + extra).replace(/\n$/, '')), 4);
  });

  return stream;
};

exports['default'] = createReporter;
module.exports = exports['default'];