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

(function (global, factory) {
    'use strict';

    // Universal Module Definition (UMD) to support AMD, CommonJS/Node.js,
    // Rhino, and plain browser loading.
    if (typeof define === 'function' && define.amd) {
        define('esref', ['exports', 'estraverse'], factory);
    } else if (typeof exports !== 'undefined') {
        factory(exports, require('estraverse'));
    } else {
        factory((global.esref = {}), global.estraverse);
    }
}(this, function (exports, estraverse) {
    'use strict';

    /**
     * @class
     * @constructor
     */
    function SymbolAnalyzer(ast) {
        this.scope = this.createScope();
        this.entities = [];
        estraverse.traverse(ast, this);
        this.end();
    }

    SymbolAnalyzer.prototype = {
        /**
         * @property {{names: Object, children: Array, blockScope: {names: Object, refs: Array, children: Array}}} scope
         */
        scope: null,
        /**
         * @property {Array} entities
         */
        entities: null,

        /**
         * Creates global scope.
         * @returns {{names: Object, children: Array, blockScope: {names: Object, refs: Array, children: Array}}}
         */
        createScope: function () {
            var scope = {
                names: Object.create(null),
                children: [],
                blockScope: {
                    names: null,
                    refs: [],
                    children: []
                }
            };

            scope.blockScope.names = Object.create(scope.names);
            return scope;
        },

        /**
         * Enter a function scope.
         * @param {Number[]} range
         */
        pushScope: function (range) {
            var result = {
                names: Object.create(this.scope.blockScope.names),
                parent: this.scope,
                children: [],
                range: range
            };
            result.blockScope = {
                names: Object.create(result.names),
                refs: [],
                children: []
            };
            this.scope.children.push(result);
            this.scope = result;
        },

        /**
         * Exit a function scope
         */
        popScope: function () {
            var currentScope = this.scope,
                parentScope = currentScope.parent,
                blockScope = currentScope.blockScope;
            blockScope.refs.forEach(function (ref) {
                parentScope.blockScope.refs.push(ref);
            });
            this.scope = currentScope.parent;
            delete blockScope.refs;
            delete currentScope.parent;
        },

        /**
         * Enters block scope
         * @param {Array} range
         */
        pushBlockScope: function (range) {
            var result = {
                names: Object.create(this.scope.blockScope.names),
                refs: [],
                children: [],
                parent: this.scope.blockScope,
                range: range
            };
            this.scope.blockScope.children.push(result);
            this.scope.blockScope = result;
        },

        /**
         * Exits block scope
         */
        popBlockScope: function () {
            var blockScope = this.scope.blockScope;
            blockScope.refs.forEach(function (ref) {
                var name = ref.identifier.name;
                if (name in blockScope.names) {
                    blockScope.names[name].references.push(ref);
                } else {
                    blockScope.parent.refs.push(ref);
                }
            });
            this.scope.blockScope = this.scope.blockScope.parent;
            delete blockScope.refs;
            delete blockScope.parent;
        },

        /**
         * Register a reference of the symbol
         * @param identifier
         * @param {String} accessType
         */
        registerReference: function (identifier, accessType) {
            this.scope.blockScope.refs.push({
                identifier: identifier,
                access: accessType
            });
        },

        /**
         * Register a declaration of the symbol
         * @param declaration
         * @param {Boolean} inBlockScope
         */
        registerDeclaration: function (declaration, inBlockScope) {
            //TODO: support Harmony
            //if (inBlockScope) {
            //    this.scope.blockScope.names[declaration.name] = {
            //        declaration: declaration,
            //        references: []
            //    };
            //    this.entities.push(this.blockScope.names[declaration.name]);
            //} else {
            this.scope.names[declaration.name] = {
                declaration: declaration,
                references: []
            };
            this.entities.push(this.scope.names[declaration.name]);
            //}
        },

        /**
         * @protected
         * @param node
         * @param parent
         */
        enter: function (node, parent) {
            var args, i, ln, accessType, parentType = parent && parent.type;
            switch (node.type) {
                case "Identifier":
                    if (parentType === "Member" ||
                        parentType === "FunctionDeclaration" ||
                        parentType === "FunctionExpression" ||
                        parentType === "NewExpression" ||
                        parentType === "Property" && parent.key == node ||
                        parentType === "VariableDeclarator" && !parent.init ||
                        parentType === "MemberExpression" && !parent.computed && node === parent.property) {
                        break;
                    } else if (parentType === "UpdateExpression" && node === parent.argument) {
                        accessType = 'RW'
                    } else if (parentType === "AssignmentExpression" && node == parent.left) {
                        accessType = 'W';
                    } else if (parentType === "VariableDeclarator" && parent.init) {
                        accessType = 'W';
                    } else {
                        accessType = 'R';
                    }
                    this.registerReference(node, accessType);
                    break;
                case "VariableDeclarator":
                    this.registerDeclaration(node.id, parent.kind === 'let');
                    break;
                case "FunctionDeclaration":
                case "FunctionExpression":
                    if (node.id) {
                        this.registerDeclaration(node.id, false);
                    }
                    this.pushScope(node.range);
                    for (args = node.params, i = 0, ln = args.length; i < ln; i++) {
                        this.registerDeclaration(args[i], false);
                    }
                    this.registerDeclaration({
                        type: 'Identifier',
                        name: 'arguments',
                        range: [node.range[0], node.range[0]]
                    }, false);
                    break;
                case "ForStatement":
                case "ForInStatement":
                case "BlockStatement":
                case "CatchClause":
                    this.pushBlockScope(node.range);
                    break;
            }
        },

        /**
         * @protected
         * @param node
         */
        leave: function (node) {
            switch (node.type) {
                case "FunctionDeclaration":
                case "FunctionExpression":
                    this.popScope();
                    break;
                case "ForStatement":
                case "ForInStatement":
                case "BlockStatement":
                case "CatchClause":
                    this.popBlockScope();
                    break;
            }
        },

        /**
         * End analysis and push yet undefined names to entities.
         */
        end: function () {
            var refs = this.scope.blockScope.refs,
                names = this.scope.names;
            for (var i = 0; i < refs.length; i++) {
                var name = refs[i].identifier.name;
                if (name in names) {
                    names[name].references.push(refs[i]);
                } else {
                    names[name] = {
                        declaration: null,
                        references: [refs[i]]
                    };
                    this.entities.push(names[name]);
                }
            }
            delete this.scope.blockScope.refs;
        }
    };

    exports.analyze = function (ast) {
        var sa = new SymbolAnalyzer(ast);
        return sa;
    }
}));