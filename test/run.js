/*
  Copyright (C) 2013 Bei Zhang <ikarienator@gmail.com>

  Redistribution and use in source and binary forms, with or without
  modification, are permitted provided that the following conditions are met:

    * Redistributions of source code must retain the above copyright
      notice, this list of conditions and the following disclaimer.
    * Redistributions in binary form must reproduce the above copyright
      notice, this list of conditions and the following disclaimer in the
      documentation and/or other materials provided with the distribution.

  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
  AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
  IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
  ARE DISCLAIMED. IN NO EVENT SHALL <COPYRIGHT HOLDER> BE LIABLE FOR ANY
  DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
  (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
  LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
  ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
  (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
  THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/

var esprima = require('esprima');
var esref = require('../esref.js');
var fs = require('fs');
var path = require('path');
var jsFile = /.*\.js$/;

function runTestFile(file) {
    var match = jsFile.exec(file);
    if (match) {
        fs.exists(file, function (ex) {
            if (ex) {
                fs.exists(file + 'on', function (ex) {
                    var js = fs.readFileSync(file, 'utf-8'),
                        json;
                    js = js.replace(/\/\*[\W\w\s]*\*\//g, '');
                    if (ex) {
                        json = fs.readFileSync(file + 'on', 'utf-8');
                    } else {
                        json = '';
                    }
                    runTestCase(file, js.trim(), json.trim());
                });
            } else {
                console.error('File not found: ' + file);
                process.exit(1);
            }
        });
    }
}

function runTestCase(name, js, json) {
    console.log('Running test case: ' + name);
    var sa = esref.analyze(esprima.parse(js, {range: true}));
    var result = JSON.stringify(sa, null, 4);
    if (json != result) {
        console.error('[Error] Expect: ' + json +
            '\n        Actual: ' + result);
        fs.writeFile(name + '.actual.json', result, function () {
            process.exit(1);
        });
        return;
    }
}

function loadDefaultSets() {
    var base = path.join(__dirname, 'data');
    fs.readdir(base, function (err, list) {
        if (err) {
            console.error(err);
            process.exit(1);
        } else {
            list.forEach(function (item) {
                runTestFile(path.join(base, item));
            });
        }
    });
}

if (process.argv.length > 2) {
    (function () {
        for (var i = 2; i < process.argv.length; i++) {
            runTestFile(path.join(process.env.PWD, process.argv[i]));
        }
    }());
} else {
    loadDefaultSets();
}
