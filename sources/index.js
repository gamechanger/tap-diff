import chalk from 'chalk';
import duplexer from 'duplexer';
import figures from 'figures';
import through2 from 'through2';
import parser from 'tap-parser';
import prettyMs from 'pretty-ms';
import getSource from 'get-source';
import difflet from 'difflet';
import ansidiff from 'ansidiff';

let diff = difflet({indent: 4});

const INDENT = '  ';
const FIG_TICK = figures.tick;
const FIG_CROSS = figures.cross;

const createReporter = () => {
  const output = through2();
  const p = parser();
  const stream = duplexer(p, output);
  const startedAt = Date.now();

  const println = (input = '', indentLevel = 0) => {
    let indent = '';

    for (let i = 0; i < indentLevel; ++i) {
      indent += INDENT;
    }

    input.split('\n').forEach(line => {
      output.push(`${indent}${line}`);
      output.push('\n');
    });
  };

  const handleTest = name => {
    println();
    println(chalk.blue(name), 1);
  };

  const handleAssertSuccess = assert => {
    const name = assert.name;

    println(`${chalk.green(FIG_TICK)}  ${chalk.dim(name)}`, 2)
  };

  const toString = (arg) => Object.prototype.toString.call(arg).slice(8, -1).toLowerCase()

  const JSONize = (str) => {
    return str
      // wrap keys without quote with valid double quote
      .replace(/([\$\w]+)\s*:/g, (_, $1) => '"'+$1+'": ')
      // replacing single quote wrapped ones to double quote
      .replace(/'([^']+)'/g, (_, $1) => '"' + $1 + '"')
  }

  const objectize = (arg) => {
    if (typeof arg === 'string') {
      try {
        // the assert event only returns strings which is broken so this
        // handles converting strings into objects
        if (arg.indexOf('{') > -1) {
          arg = JSON.parse(JSONize(arg));
        }
      } catch (e) {
        try {
          arg = eval(`(${arg})`);
        } catch (e) {
          // do nothing because it wasn't a valid json object
        }
      }
    }
    return arg;
  }

  const handleAssertFailure = assert => {
    const name = assert.name;

    let {
      at,
      actual,
      expected
    } = assert.diag

    at = processSourceMap(at);

    println(`${chalk.red(FIG_CROSS)}  ${chalk.red(name)} at ${chalk.magenta(at)}`, 2);

    try {

      actual = objectize(actual);
      expected = objectize(expected);

      let str = '';
      if (actual && expected) {
        if (typeof expected !== typeof actual ||
          typeof expected === 'object' && (!actual || !expected)) {
          str = chalk.grey('Expected ') + chalk.white(typeof expected) + chalk.grey(' but got ') + chalk.white(typeof actual);
        } else if (typeof expected === 'string') {
          if (str.indexOf('\n') >= 0) {
            str = ansidiff.lines(expected, actual);
          } else {
            str = ansidiff.chars(expected, actual);
          }
        } else if (typeof expected === 'object') {
          str = diff.compare(expected, actual);
        } else {
          str = chalk.grey('Expected ') + chalk.white('' + expected) + chalk.grey(' but got ') + chalk.white('' + actual);
        }
      }
      if (str != '') {
        str.replace(/\n/g, '\n      ');
        output.push(str);
      }
      println()
    } catch (e) {
      console.log(e);
    }
  };

  const processSourceMap = (at) => {
    let re = /\((.*)\:(\d*)\:(\d*)\)$/
    let parsed = at.match(re);
    let file = parsed[1];
    let line = Number(parsed[2]);
    let column = Number(parsed[3]);

    let sourceFile = getSource(file);
    let resolved = sourceFile.resolve({line: line, column: column});

    return at.replace(re, `(${resolved.sourceFile.path}:${resolved.line}:${resolved.column})`)
  };

  const handleComplete = result => {
    const finishedAt = Date.now();


    println();
    println(
      chalk.green(`passed: ${result.pass}  `) +
      chalk.red(`failed: ${result.fail || 0}  `) +
      chalk.white(`of ${result.count} tests  `) +
      chalk.dim(`(${prettyMs(finishedAt - startedAt)})`)
    );
    println();

    if (result.ok) {
      println(chalk.green(`All of ${result.count} tests passed!`));
      println();
    } else {
      println(chalk.red(`${result.fail || 0} of ${result.count} tests failed.`));
      println();
      stream.isFailed = true;
      println(chalk.red('FAILURES:'))

      for (var i = result.failures.length - 1; i >= 0; i--) {
        println();
        handleAssertFailure(result.failures[i]);
      }

      println();
    }

  };

  p.on('comment', (comment) => {
    const trimmed = comment.replace('# ', '').trim();

    if (/^tests\s+[0-9]+$/.test(trimmed)) return;
    if (/^pass\s+[0-9]+$/.test(trimmed)) return;
    if (/^fail\s+[0-9]+$/.test(trimmed)) return;
    if (/^ok$/.test(trimmed)) return;

    handleTest(trimmed);
  });

  p.on('assert', (assert) => {
    if (assert.ok) return handleAssertSuccess(assert);

    handleAssertFailure(assert);
  });

  p.on('complete', handleComplete);

  p.on('child', (child) => {
    ;
  });

  p.on('extra', extra => {
    println(chalk.yellow(`${extra}`.replace(/\n$/, '')), 4);
  });

  return stream;
};

export default createReporter;
