(function () {
  var main = null;
  var modules = {
      "require": {
          factory: undefined,
          dependencies: [],
          exports: function (args, callback) { return require(args, callback); },
          resolved: true
      }
  };
  function define(id, dependencies, factory) {
      return main = modules[id] = {
          dependencies: dependencies,
          factory: factory,
          exports: {},
          resolved: false
      };
  }
  function resolve(definition) {
      if (definition.resolved === true)
          return;
      definition.resolved = true;
      var dependencies = definition.dependencies.map(function (id) {
          return (id === "exports")
              ? definition.exports
              : (function () {
                  if(modules[id] !== undefined) {
                    resolve(modules[id]);
                    return modules[id].exports;
                  } else {
                    try {
                      return require(id);
                    } catch(e) {
                      throw Error("module '" + id + "' not found.");
                    }
                  }
              })();
      });
      definition.factory.apply(null, dependencies);
  }
  function collect() {
      Object.keys(modules).map(function (key) { return modules[key]; }).forEach(resolve);
      return (main !== null) 
        ? main.exports
        : undefined
  }

  define("editor/editor", ["require", "exports"], function (require, exports) {
      "use strict";
      exports.__esModule = true;
      var Editor = (function () {
          function Editor(element, language, debounce) {
              if (debounce === void 0) { debounce = 1000; }
              var _this = this;
              this.element = element;
              this.language = language;
              this.debounce = debounce;
              this.onchange = [];
              this.content = "";
              this.lastupdate = Date.now();
              this.editor = ace.edit(element);
              this.editor.getSession().setUseWorker(false);
              this.editor.setTheme("ace/theme/ambiance");
              this.editor.getSession().setMode("ace/mode/" + language);
              this.editor.setFontSize("16px");
              this.editor.setShowPrintMargin(false);
              this.editor.$blockScrolling = Infinity;
              this.editor.commands.addCommand({
                  name: 'save',
                  bindKey: { win: "Ctrl-S", "mac": "Cmd-S" },
                  exec: function (editor) {
                      var current = _this.editor.getValue();
                      if (_this.content !== current) {
                          _this.onchange.forEach(function (func) { return func(current); });
                          _this.content = current;
                      }
                  }
              });
              setTimeout(function () {
                  var current = _this.editor.getValue();
                  if (_this.content !== current) {
                      _this.onchange.forEach(function (func) { return func(current); });
                      _this.content = current;
                  }
              }, 10);
          }
          Editor.prototype.set = function (text) {
              this.editor.setValue(text);
              this.editor.selection.clearSelection();
          };
          Editor.prototype.get = function () {
              return this.editor.getValue();
          };
          Editor.prototype.change = function (func) {
              this.onchange.push(func);
          };
          return Editor;
      }());
      exports.Editor = Editor;
  });
  define("editor/index", ["require", "exports", "editor/editor"], function (require, exports, editor_1) {
      "use strict";
      exports.__esModule = true;
      exports.Editor = editor_1.Editor;
  });
  define("gpu/dispose", ["require", "exports"], function (require, exports) {
      "use strict";
      exports.__esModule = true;
  });
  define("gpu/color", ["require", "exports"], function (require, exports) {
      "use strict";
      exports.__esModule = true;
      exports.compute_texture_dimensions = function (length) {
          var x = Math.ceil(Math.sqrt(length));
          x = (x < 4) ? 4 : x;
          return { width: x, height: x };
      };
      var Color1D = (function () {
          function Color1D(context, framebuf, length) {
              var _a = exports.compute_texture_dimensions(length), width = _a.width, height = _a.height;
              this.type = "Color1D";
              this.context = context;
              this.framebuf = framebuf;
              this.width = length;
              this.textureWidth = width;
              this.textureHeight = height;
              this.textureData = new Uint8Array((width * height) * 4);
              this.data = new Uint8Array(this.textureData.buffer, 0, (length * 4));
              this.texture = this.context.createTexture();
              this.context.bindTexture(this.context.TEXTURE_2D, this.texture);
              this.context.texParameteri(this.context.TEXTURE_2D, this.context.TEXTURE_MIN_FILTER, this.context.NEAREST);
              this.context.texParameteri(this.context.TEXTURE_2D, this.context.TEXTURE_MAG_FILTER, this.context.NEAREST);
              this.context.texParameteri(this.context.TEXTURE_2D, this.context.TEXTURE_WRAP_S, this.context.CLAMP_TO_EDGE);
              this.context.texParameteri(this.context.TEXTURE_2D, this.context.TEXTURE_WRAP_T, this.context.CLAMP_TO_EDGE);
              this.context.bindTexture(this.context.TEXTURE_2D, null);
              this.push();
          }
          Color1D.prototype.get = function (x) {
              var index = (x * 4);
              return [
                  this.data[index + 0],
                  this.data[index + 1],
                  this.data[index + 2],
                  this.data[index + 3]
              ];
          };
          Color1D.prototype.set = function (x, c) {
              var index = (x * 4);
              this.data[index + 0] = c[0];
              this.data[index + 1] = c[1];
              this.data[index + 2] = c[2];
              this.data[index + 3] = c[3];
              return this;
          };
          Color1D.prototype.map = function (func) {
              for (var x = 0; x < this.width; x++) {
                  this.set(x, func(x));
              }
              return this;
          };
          Color1D.prototype.push = function () {
              this.context.bindTexture(this.context.TEXTURE_2D, this.texture);
              this.context.texImage2D(this.context.TEXTURE_2D, 0, this.context.RGBA, this.textureWidth, this.textureHeight, 0, this.context.RGBA, this.context.UNSIGNED_BYTE, this.textureData);
              this.context.bindTexture(this.context.TEXTURE_2D, null);
              return this;
          };
          Color1D.prototype.pull = function () {
              this.context.bindFramebuffer(this.context.FRAMEBUFFER, this.framebuf);
              this.context.framebufferTexture2D(this.context.FRAMEBUFFER, this.context.COLOR_ATTACHMENT0, this.context.TEXTURE_2D, this.texture, 0);
              if (this.context.checkFramebufferStatus(this.context.FRAMEBUFFER) != this.context.FRAMEBUFFER_COMPLETE) {
                  console.warn("Color1D: unable to read array due to incomplete framebuffer attachement");
              }
              this.context.readPixels(0, 0, this.textureWidth, this.textureHeight, this.context.RGBA, this.context.UNSIGNED_BYTE, this.textureData, 0);
              this.context.bindFramebuffer(this.context.FRAMEBUFFER, null);
              return this;
          };
          Color1D.prototype.dispose = function () {
              this.context.deleteTexture(this.texture);
          };
          return Color1D;
      }());
      exports.Color1D = Color1D;
      var Color2D = (function () {
          function Color2D(context, framebuf, width, height) {
              this.type = "Color2D";
              this.context = context;
              this.framebuf = framebuf;
              this.width = width;
              this.height = height;
              this.textureWidth = width;
              this.textureHeight = height;
              this.textureData = new Uint8Array(width * height * 4);
              this.data = new Uint8Array(this.textureData.buffer);
              this.texture = this.context.createTexture();
              this.context.bindTexture(this.context.TEXTURE_2D, this.texture);
              this.context.texParameteri(this.context.TEXTURE_2D, this.context.TEXTURE_MIN_FILTER, this.context.NEAREST);
              this.context.texParameteri(this.context.TEXTURE_2D, this.context.TEXTURE_MAG_FILTER, this.context.NEAREST);
              this.context.texParameteri(this.context.TEXTURE_2D, this.context.TEXTURE_WRAP_S, this.context.CLAMP_TO_EDGE);
              this.context.texParameteri(this.context.TEXTURE_2D, this.context.TEXTURE_WRAP_T, this.context.CLAMP_TO_EDGE);
              this.context.bindTexture(this.context.TEXTURE_2D, null);
              this.push();
          }
          Color2D.prototype.get = function (x, y) {
              var index = (x + (y * this.width)) * 4;
              return [
                  this.data[index + 0],
                  this.data[index + 1],
                  this.data[index + 2],
                  this.data[index + 3]
              ];
          };
          Color2D.prototype.set = function (x, y, c) {
              var index = (x + (y * this.width)) * 4;
              this.data[index + 0] = c[0];
              this.data[index + 1] = c[1];
              this.data[index + 2] = c[2];
              this.data[index + 3] = c[3];
              return this;
          };
          Color2D.prototype.map = function (func) {
              for (var y = 0; y < this.height; y++) {
                  for (var x = 0; x < this.width; x++) {
                      this.set(x, y, func(x, y));
                  }
              }
              return this;
          };
          Color2D.prototype.push = function () {
              this.context.bindTexture(this.context.TEXTURE_2D, this.texture);
              this.context.texImage2D(this.context.TEXTURE_2D, 0, this.context.RGBA, this.textureWidth, this.textureHeight, 0, this.context.RGBA, this.context.UNSIGNED_BYTE, this.textureData);
              this.context.bindTexture(this.context.TEXTURE_2D, null);
              return this;
          };
          Color2D.prototype.pull = function () {
              this.context.bindFramebuffer(this.context.FRAMEBUFFER, this.framebuf);
              this.context.framebufferTexture2D(this.context.FRAMEBUFFER, this.context.COLOR_ATTACHMENT0, this.context.TEXTURE_2D, this.texture, 0);
              if (this.context.checkFramebufferStatus(this.context.FRAMEBUFFER) != this.context.FRAMEBUFFER_COMPLETE) {
                  console.warn("Color2D: unable to read array due to incomplete framebuffer attachement");
              }
              this.context.readPixels(0, 0, this.textureWidth, this.textureHeight, this.context.RGBA, this.context.UNSIGNED_BYTE, this.textureData, 0);
              this.context.bindFramebuffer(this.context.FRAMEBUFFER, null);
              return this;
          };
          Color2D.prototype.dispose = function () {
              this.context.deleteTexture(this.texture);
          };
          return Color2D;
      }());
      exports.Color2D = Color2D;
      var Color3D = (function () {
          function Color3D(context, framebuf, width, height, depth) {
              var size = exports.compute_texture_dimensions(width * height * depth);
              this.type = "Color3D";
              this.context = context;
              this.framebuf = framebuf;
              this.width = width;
              this.height = height;
              this.depth = depth;
              this.textureWidth = size.width;
              this.textureHeight = size.height;
              this.textureData = new Uint8Array(size.width * size.height * 4);
              this.data = new Uint8Array(this.textureData.buffer, 0, (width * height * depth) * 4);
              this.texture = this.context.createTexture();
              this.context.bindTexture(this.context.TEXTURE_2D, this.texture);
              this.context.texParameteri(this.context.TEXTURE_2D, this.context.TEXTURE_MIN_FILTER, this.context.NEAREST);
              this.context.texParameteri(this.context.TEXTURE_2D, this.context.TEXTURE_MAG_FILTER, this.context.NEAREST);
              this.context.texParameteri(this.context.TEXTURE_2D, this.context.TEXTURE_WRAP_S, this.context.CLAMP_TO_EDGE);
              this.context.texParameteri(this.context.TEXTURE_2D, this.context.TEXTURE_WRAP_T, this.context.CLAMP_TO_EDGE);
              this.context.bindTexture(this.context.TEXTURE_2D, null);
              this.push();
          }
          Color3D.prototype.get = function (x, y, z) {
              var index = (x + (y * this.width) + (z * (this.width * this.height))) * 4;
              return [
                  this.data[index + 0],
                  this.data[index + 1],
                  this.data[index + 2],
                  this.data[index + 3]
              ];
          };
          Color3D.prototype.set = function (x, y, z, c) {
              var index = (x + (y * this.width) + (z * (this.width * this.height))) * 4;
              this.data[index + 0] = c[0];
              this.data[index + 1] = c[1];
              this.data[index + 2] = c[2];
              this.data[index + 3] = c[3];
              return this;
          };
          Color3D.prototype.map = function (func) {
              for (var z = 0; z < this.depth; z++) {
                  for (var y = 0; y < this.height; y++) {
                      for (var x = 0; x < this.width; x++) {
                          this.set(x, y, z, func(x, y, z));
                      }
                  }
              }
              return this;
          };
          Color3D.prototype.push = function () {
              this.context.bindTexture(this.context.TEXTURE_2D, this.texture);
              this.context.texImage2D(this.context.TEXTURE_2D, 0, this.context.RGBA, this.textureWidth, this.textureHeight, 0, this.context.RGBA, this.context.UNSIGNED_BYTE, this.textureData);
              this.context.bindTexture(this.context.TEXTURE_2D, null);
              return this;
          };
          Color3D.prototype.pull = function () {
              this.context.bindFramebuffer(this.context.FRAMEBUFFER, this.framebuf);
              this.context.framebufferTexture2D(this.context.FRAMEBUFFER, this.context.COLOR_ATTACHMENT0, this.context.TEXTURE_2D, this.texture, 0);
              if (this.context.checkFramebufferStatus(this.context.FRAMEBUFFER) != this.context.FRAMEBUFFER_COMPLETE) {
                  console.warn("Color3D: unable to read array due to incomplete framebuffer attachement");
              }
              this.context.readPixels(0, 0, this.textureWidth, this.textureHeight, this.context.RGBA, this.context.UNSIGNED_BYTE, this.textureData, 0);
              this.context.bindFramebuffer(this.context.FRAMEBUFFER, null);
              return this;
          };
          Color3D.prototype.dispose = function () {
              this.context.deleteTexture(this.texture);
          };
          return Color3D;
      }());
      exports.Color3D = Color3D;
  });
  define("gpu/float", ["require", "exports"], function (require, exports) {
      "use strict";
      exports.__esModule = true;
      exports.compute_texture_dimensions = function (length) {
          var x = Math.ceil(Math.sqrt(length));
          x = (x < 4) ? 4 : x;
          return { width: x, height: x };
      };
      var Float1D = (function () {
          function Float1D(context, framebuf, length) {
              var _a = exports.compute_texture_dimensions(length), width = _a.width, height = _a.height;
              this.type = "Float1D";
              this.context = context;
              this.framebuf = framebuf;
              this.width = length;
              this.textureWidth = width;
              this.textureHeight = height;
              this.textureData = new Uint8Array(width * height * 4);
              this.data = new Float32Array(this.textureData.buffer, 0, this.width);
              this.texture = this.context.createTexture();
              this.context.bindTexture(this.context.TEXTURE_2D, this.texture);
              this.context.texParameteri(this.context.TEXTURE_2D, this.context.TEXTURE_MIN_FILTER, this.context.NEAREST);
              this.context.texParameteri(this.context.TEXTURE_2D, this.context.TEXTURE_MAG_FILTER, this.context.NEAREST);
              this.context.texParameteri(this.context.TEXTURE_2D, this.context.TEXTURE_WRAP_S, this.context.CLAMP_TO_EDGE);
              this.context.texParameteri(this.context.TEXTURE_2D, this.context.TEXTURE_WRAP_T, this.context.CLAMP_TO_EDGE);
              this.context.bindTexture(this.context.TEXTURE_2D, null);
              this.push();
          }
          Float1D.prototype.get = function (x) {
              return this.data[x];
          };
          Float1D.prototype.set = function (x, v) {
              this.data[x] = v;
              return this;
          };
          Float1D.prototype.map = function (func) {
              for (var x = 0; x < this.width; x++) {
                  this.set(x, func(x));
              }
              return this;
          };
          Float1D.prototype.push = function () {
              this.context.bindTexture(this.context.TEXTURE_2D, this.texture);
              this.context.texImage2D(this.context.TEXTURE_2D, 0, this.context.RGBA, this.textureWidth, this.textureHeight, 0, this.context.RGBA, this.context.UNSIGNED_BYTE, this.textureData);
              this.context.bindTexture(this.context.TEXTURE_2D, null);
              return this;
          };
          Float1D.prototype.pull = function () {
              this.context.bindFramebuffer(this.context.FRAMEBUFFER, this.framebuf);
              this.context.framebufferTexture2D(this.context.FRAMEBUFFER, this.context.COLOR_ATTACHMENT0, this.context.TEXTURE_2D, this.texture, 0);
              if (this.context.checkFramebufferStatus(this.context.FRAMEBUFFER) != this.context.FRAMEBUFFER_COMPLETE) {
                  console.warn("Float1D: unable to read array due to incomplete framebuffer attachement");
              }
              this.context.readPixels(0, 0, this.textureWidth, this.textureHeight, this.context.RGBA, this.context.UNSIGNED_BYTE, this.textureData, 0);
              this.context.bindFramebuffer(this.context.FRAMEBUFFER, null);
              return this;
          };
          Float1D.prototype.dispose = function () {
              this.context.deleteTexture(this.texture);
          };
          return Float1D;
      }());
      exports.Float1D = Float1D;
      var Float2D = (function () {
          function Float2D(context, framebuf, width, height) {
              this.type = "Float2D";
              this.context = context;
              this.framebuf = framebuf;
              this.width = width;
              this.height = height;
              this.textureWidth = width;
              this.textureHeight = height;
              this.textureData = new Uint8Array(width * height * 4);
              this.data = new Float32Array(this.textureData.buffer);
              this.texture = this.context.createTexture();
              this.context.bindTexture(this.context.TEXTURE_2D, this.texture);
              this.context.texParameteri(this.context.TEXTURE_2D, this.context.TEXTURE_MIN_FILTER, this.context.NEAREST);
              this.context.texParameteri(this.context.TEXTURE_2D, this.context.TEXTURE_MAG_FILTER, this.context.NEAREST);
              this.context.texParameteri(this.context.TEXTURE_2D, this.context.TEXTURE_WRAP_S, this.context.CLAMP_TO_EDGE);
              this.context.texParameteri(this.context.TEXTURE_2D, this.context.TEXTURE_WRAP_T, this.context.CLAMP_TO_EDGE);
              this.context.bindTexture(this.context.TEXTURE_2D, null);
              this.push();
          }
          Float2D.prototype.get = function (x, y) {
              return this.data[x + (y * this.width)];
          };
          Float2D.prototype.set = function (x, y, v) {
              this.data[x + (y * this.width)] = v;
              return this;
          };
          Float2D.prototype.map = function (func) {
              for (var y = 0; y < this.height; y++) {
                  for (var x = 0; x < this.width; x++) {
                      this.set(x, y, func(x, y));
                  }
              }
              return this;
          };
          Float2D.prototype.push = function () {
              this.context.bindTexture(this.context.TEXTURE_2D, this.texture);
              this.context.texImage2D(this.context.TEXTURE_2D, 0, this.context.RGBA, this.textureWidth, this.textureHeight, 0, this.context.RGBA, this.context.UNSIGNED_BYTE, this.textureData);
              this.context.bindTexture(this.context.TEXTURE_2D, null);
              return this;
          };
          Float2D.prototype.pull = function () {
              this.context.bindFramebuffer(this.context.FRAMEBUFFER, this.framebuf);
              this.context.framebufferTexture2D(this.context.FRAMEBUFFER, this.context.COLOR_ATTACHMENT0, this.context.TEXTURE_2D, this.texture, 0);
              if (this.context.checkFramebufferStatus(this.context.FRAMEBUFFER) != this.context.FRAMEBUFFER_COMPLETE) {
                  console.warn("Float2D: unable to read array due to incomplete framebuffer attachement");
              }
              this.context.readPixels(0, 0, this.textureWidth, this.textureHeight, this.context.RGBA, this.context.UNSIGNED_BYTE, this.textureData, 0);
              this.context.bindFramebuffer(this.context.FRAMEBUFFER, null);
              return this;
          };
          Float2D.prototype.dispose = function () {
              this.context.deleteTexture(this.texture);
          };
          return Float2D;
      }());
      exports.Float2D = Float2D;
      var Float3D = (function () {
          function Float3D(context, framebuf, width, height, depth) {
              var size = exports.compute_texture_dimensions(width * height * depth);
              this.type = "Float3D";
              this.context = context;
              this.framebuf = framebuf;
              this.width = width;
              this.height = height;
              this.depth = depth;
              this.textureWidth = size.width;
              this.textureHeight = size.height;
              this.textureData = new Uint8Array(size.width * size.height * 4);
              this.data = new Float32Array(this.textureData.buffer, 0, (width * height * depth));
              this.texture = this.context.createTexture();
              this.context.bindTexture(this.context.TEXTURE_2D, this.texture);
              this.context.texParameteri(this.context.TEXTURE_2D, this.context.TEXTURE_MIN_FILTER, this.context.NEAREST);
              this.context.texParameteri(this.context.TEXTURE_2D, this.context.TEXTURE_MAG_FILTER, this.context.NEAREST);
              this.context.texParameteri(this.context.TEXTURE_2D, this.context.TEXTURE_WRAP_S, this.context.CLAMP_TO_EDGE);
              this.context.texParameteri(this.context.TEXTURE_2D, this.context.TEXTURE_WRAP_T, this.context.CLAMP_TO_EDGE);
              this.context.bindTexture(this.context.TEXTURE_2D, null);
              this.push();
          }
          Float3D.prototype.get = function (x, y, z) {
              return this.data[x + (y * this.width) + (z * (this.width * this.height))];
          };
          Float3D.prototype.set = function (x, y, z, v) {
              this.data[x + (y * this.width) + (z * (this.width * this.height))] = v;
              return this;
          };
          Float3D.prototype.map = function (func) {
              for (var z = 0; z < this.depth; z++) {
                  for (var y = 0; y < this.height; y++) {
                      for (var x = 0; x < this.width; x++) {
                          this.set(x, y, z, func(x, y, z));
                      }
                  }
              }
              return this;
          };
          Float3D.prototype.push = function () {
              this.context.bindTexture(this.context.TEXTURE_2D, this.texture);
              this.context.texImage2D(this.context.TEXTURE_2D, 0, this.context.RGBA, this.textureWidth, this.textureHeight, 0, this.context.RGBA, this.context.UNSIGNED_BYTE, this.textureData);
              this.context.bindTexture(this.context.TEXTURE_2D, null);
              return this;
          };
          Float3D.prototype.pull = function () {
              this.context.bindFramebuffer(this.context.FRAMEBUFFER, this.framebuf);
              this.context.framebufferTexture2D(this.context.FRAMEBUFFER, this.context.COLOR_ATTACHMENT0, this.context.TEXTURE_2D, this.texture, 0);
              if (this.context.checkFramebufferStatus(this.context.FRAMEBUFFER) != this.context.FRAMEBUFFER_COMPLETE) {
                  console.warn("Float3D: unable to read array due to incomplete framebuffer attachement");
              }
              this.context.readPixels(0, 0, this.textureWidth, this.textureHeight, this.context.RGBA, this.context.UNSIGNED_BYTE, this.textureData, 0);
              this.context.bindFramebuffer(this.context.FRAMEBUFFER, null);
              return this;
          };
          Float3D.prototype.dispose = function () {
              this.context.deleteTexture(this.texture);
          };
          return Float3D;
      }());
      exports.Float3D = Float3D;
  });
  define("gpu/plane", ["require", "exports"], function (require, exports) {
      "use strict";
      exports.__esModule = true;
      var Plane = (function () {
          function Plane(context) {
              this.context = context;
              this.position = this.context.createBuffer();
              this.context.bindBuffer(this.context.ARRAY_BUFFER, this.position);
              this.context.bufferData(this.context.ARRAY_BUFFER, new Float32Array([
                  -1.0, -1.0, 0.0,
                  -1.0, 1.0, 0.0,
                  1.0, 1.0, 0.0,
                  1.0, -1.0, 0.0
              ]), this.context.STATIC_DRAW);
              this.texcoord = this.context.createBuffer();
              this.context.bindBuffer(this.context.ARRAY_BUFFER, this.texcoord);
              this.context.bufferData(this.context.ARRAY_BUFFER, new Float32Array([
                  0.0, 0.0,
                  0.0, 1.0,
                  1.0, 1.0,
                  1.0, 0.0
              ]), this.context.STATIC_DRAW);
              this.indices = this.context.createBuffer();
              this.context.bindBuffer(this.context.ELEMENT_ARRAY_BUFFER, this.indices);
              this.context.bufferData(this.context.ELEMENT_ARRAY_BUFFER, new Uint16Array([
                  0, 1, 2, 2, 3, 0
              ]), this.context.STATIC_DRAW);
          }
          Plane.prototype.dispose = function () {
              this.context.deleteBuffer(this.position);
              this.context.deleteBuffer(this.texcoord);
              this.context.deleteBuffer(this.indices);
          };
          return Plane;
      }());
      exports.Plane = Plane;
  });
  define("gpu/script", ["require", "exports"], function (require, exports) {
      "use strict";
      exports.__esModule = true;
      var matcher = function (_expr) {
          if (_expr === void 0) { _expr = ""; }
          var extract = function (code, regex) {
              var buffer = [];
              while (true) {
                  var match = regex.exec(code);
                  if (!match) {
                      return buffer;
                  }
                  else {
                      if (match[0].length === 0)
                          throw Error("zero length match.");
                      code = code.substr(match.index + match[0].length);
                      var literal = match.shift();
                      var captures = match;
                      buffer.push({ literal: literal, captures: captures });
                  }
              }
          };
          return {
              literal: function (x) { return matcher(_expr + x); },
              alphanumeric: function () { return matcher(_expr + "\\w+"); },
              numberic: function () { return matcher(_expr + "[0-9]+"); },
              anything: function () { return matcher(_expr + ".*"); },
              codeblock: function () { return matcher(_expr + "[\\w\\s\\+\\-\\*\\/%\\(\),:;]+"); },
              space: function () { return matcher(_expr + "\\s"); },
              space_optional: function () { return matcher(_expr + "\\s*"); },
              space_mandated: function () { return matcher(_expr + "\\s+"); },
              colon: function () { return matcher(_expr + ":"); },
              semicolon: function () { return matcher(_expr + ";"); },
              dot: function () { return matcher(_expr + "\\."); },
              comma: function () { return matcher(_expr + "\\,"); },
              bracket_open: function () { return matcher(_expr + "\\["); },
              bracket_close: function () { return matcher(_expr + "\\]"); },
              parentheses_open: function () { return matcher(_expr + "\\("); },
              parentheses_close: function () { return matcher(_expr + "\\)"); },
              curly_open: function () { return matcher(_expr + "\\{"); },
              curly_close: function () { return matcher(_expr + "\\}"); },
              capture: function (_inner) { return matcher(_expr + "(" + _inner.expr() + ")"); },
              upto: function (_inner) { return matcher(_expr + _inner.expr() + "?"); },
              anyof: function (_inner) { return matcher(_expr + "[" + _inner.map(function (n) { return n.expr(); }).join("|") + "]*"); },
              optional: function (_inner) { return matcher(_expr + "[" + _inner.expr() + "]*"); },
              expr: function () { return _expr; },
              match: function (s) { return extract(s, new RegExp(_expr)); }
          };
      };
      exports.read_program_thread_function = function (code) {
          var expression = matcher()
              .bracket_open()
              .capture(matcher().codeblock())
              .bracket_close()
              .space_optional()
              .literal("thread")
              .space_optional()
              .parentheses_open()
              .capture(matcher().codeblock())
              .parentheses_close();
          var results = expression.match(code);
          if (results.length === 0) {
              return {
                  indexing: "error",
                  outputs: []
              };
          }
          var outputs = results[0].captures[0].split(",").map(function (n) { return n.trim(); });
          for (var i = 0; i < outputs.length; i++) {
              if (outputs[i] !== "float" && outputs[i] !== "color") {
                  return {
                      indexing: "error",
                      outputs: []
                  };
              }
          }
          var argumentCount = results[0].captures[1].split(",").length;
          var indexing = "error";
          switch (argumentCount) {
              case 1:
                  indexing = "1D";
                  break;
              case 2:
                  indexing = "2D";
                  break;
              case 3:
                  indexing = "3D";
                  break;
              default:
                  indexing = "error";
                  break;
          }
          return {
              indexing: indexing,
              outputs: outputs
          };
      };
      exports.read_program_uniforms = function (code) {
          var expression = matcher()
              .literal("uniform")
              .space_mandated()
              .capture(matcher().alphanumeric())
              .space_mandated()
              .capture(matcher().alphanumeric())
              .space_optional()
              .upto(matcher().semicolon());
          return expression.match(code).map(function (match) { return ({
              type: match.captures[0],
              name: match.captures[1]
          }); });
      };
      exports.replace_thread_output_indexer = function (code) {
          var results = matcher()
              .bracket_open()
              .capture(matcher().codeblock())
              .bracket_close()
              .space_optional()
              .literal("thread")
              .space_optional()
              .parentheses_open()
              .codeblock()
              .parentheses_close()
              .space_optional()
              .curly_open()
              .match(code);
          var outputs = results[0].captures[0].split(",").map(function (n) { return n.trim(); });
          return outputs.reduce(function (code, output, index) {
              return matcher()
                  .literal("thread")
                  .space_optional()
                  .bracket_open()
                  .space_optional()
                  .capture(matcher().literal(index.toString()))
                  .space_optional()
                  .bracket_close()
                  .match(code).reduce(function (acc, match) {
                  switch (output) {
                      case "float": return acc.replace(match.literal, "nc_thread_output_" + index + ".r");
                      case "color": return acc.replace(match.literal, "nc_thread_output_" + index);
                  }
                  return acc;
              }, code);
          }, code);
      };
      exports.replace_thread_output_dimensions = function (code) {
          return code.replace(/thread.width/g, "nc_thread_output_width")
              .replace(/thread.height/g, "nc_thread_output_height")
              .replace(/thread.depth/g, "nc_thread_output_depth");
      };
      exports.replace_thread_signature = function (code) {
          var results = matcher()
              .bracket_open()
              .codeblock()
              .bracket_close()
              .space_optional()
              .literal("thread")
              .space_optional()
              .parentheses_open()
              .capture(matcher().codeblock())
              .parentheses_close()
              .match(code);
          return results.reduce(function (acc, extraction) {
              return acc.replace(extraction.literal, "void thread(" + extraction.captures[0] + ")");
          }, code);
      };
      exports.replace_float1D_uniform = function (code) {
          var results = matcher()
              .literal("uniform")
              .space_mandated()
              .literal("Float1D")
              .space_mandated()
              .capture(matcher().alphanumeric())
              .space_optional()
              .semicolon()
              .match(code);
          return results.reduce(function (acc, result) {
              var replacement = ["\n"];
              replacement.push("uniform sampler2D nc_uniform_" + result.captures[0] + "_texture;");
              replacement.push("uniform int       nc_uniform_" + result.captures[0] + "_textureWidth;");
              replacement.push("uniform int       nc_uniform_" + result.captures[0] + "_textureHeight;");
              replacement.push("uniform int       nc_uniform_" + result.captures[0] + "_width;");
              return acc.replace(result.literal, replacement.join("\n"));
          }, code);
      };
      exports.replace_float1D_indexer = function (code) {
          var names = matcher()
              .literal("uniform")
              .space_mandated()
              .literal("Float1D")
              .space_mandated()
              .capture(matcher().alphanumeric())
              .space_optional()
              .semicolon()
              .match(code)
              .map(function (n) { return n.captures[0]; });
          return names.reduce(function (acc, name) {
              var results = matcher()
                  .literal(name)
                  .space_optional()
                  .bracket_open()
                  .capture(matcher().codeblock())
                  .bracket_close()
                  .match(acc);
              return results.reduce(function (acc, result) {
                  return acc.replace(result.literal, "nc_decode (\n          texture ( \n            nc_uniform_" + name + "_texture,\n            nc_select_1D (\n              nc_uniform_" + name + "_textureWidth,\n              nc_uniform_" + name + "_textureHeight,\n              nc_uniform_" + name + "_width,\n              " + result.captures[0] + "\n            )\n          )\n        )");
              }, acc);
          }, code);
      };
      exports.replace_float1D_width = function (code) {
          var names = matcher()
              .literal("uniform")
              .space_mandated()
              .literal("Float1D")
              .space_mandated()
              .capture(matcher().alphanumeric())
              .space_optional()
              .semicolon()
              .match(code)
              .map(function (n) { return n.captures[0]; });
          return names.reduce(function (acc, name) {
              var results = matcher().literal(name).dot().literal("width").match(acc);
              return results.reduce(function (acc, result) {
                  return acc.replace(result.literal, "nc_uniform_" + name + "_width");
              }, acc);
          }, code);
      };
      exports.replace_float2D_uniform = function (code) {
          var results = matcher()
              .literal("uniform")
              .space_mandated()
              .literal("Float2D")
              .space_mandated()
              .capture(matcher().alphanumeric())
              .space_optional()
              .semicolon()
              .match(code);
          return results.reduce(function (acc, result) {
              var replacement = ["\n"];
              replacement.push("uniform sampler2D nc_uniform_" + result.captures[0] + "_texture;");
              replacement.push("uniform int       nc_uniform_" + result.captures[0] + "_textureWidth;");
              replacement.push("uniform int       nc_uniform_" + result.captures[0] + "_textureHeight;");
              replacement.push("uniform int       nc_uniform_" + result.captures[0] + "_width;");
              replacement.push("uniform int       nc_uniform_" + result.captures[0] + "_height;");
              return acc.replace(result.literal, replacement.join("\n"));
          }, code);
      };
      exports.replace_float2D_indexer = function (code) {
          var names = matcher()
              .literal("uniform")
              .space_mandated()
              .literal("Float2D")
              .space_mandated()
              .capture(matcher().alphanumeric())
              .space_optional()
              .semicolon()
              .match(code)
              .map(function (n) { return n.captures[0]; });
          return names.reduce(function (acc, name) {
              var results = matcher()
                  .literal(name)
                  .space_optional()
                  .bracket_open()
                  .capture(matcher().codeblock())
                  .bracket_close()
                  .space_optional()
                  .bracket_open()
                  .capture(matcher().codeblock())
                  .bracket_close()
                  .match(acc);
              return results.reduce(function (acc, result) {
                  return acc.replace(result.literal, "nc_decode (\n          texture ( \n            nc_uniform_" + name + "_texture,\n            nc_select_2D (\n              nc_uniform_" + name + "_textureWidth,\n              nc_uniform_" + name + "_textureHeight,\n              nc_uniform_" + name + "_width,\n              nc_uniform_" + name + "_height,\n              " + result.captures[0] + ",\n              " + result.captures[1] + "\n            )\n          )\n        )");
              }, acc);
          }, code);
      };
      exports.replace_float2D_width = function (code) {
          var names = matcher()
              .literal("uniform")
              .space_mandated()
              .literal("Float2D")
              .space_mandated()
              .capture(matcher().alphanumeric())
              .space_optional()
              .semicolon()
              .match(code)
              .map(function (n) { return n.captures[0]; });
          return names.reduce(function (acc, name) {
              var results = matcher().literal(name).dot().literal("width").match(acc);
              return results.reduce(function (acc, result) {
                  return acc.replace(result.literal, "nc_uniform_" + name + "_width");
              }, acc);
          }, code);
      };
      exports.replace_float2D_height = function (code) {
          var names = matcher()
              .literal("uniform")
              .space_mandated()
              .literal("Float2D")
              .space_mandated()
              .capture(matcher().alphanumeric())
              .space_optional()
              .semicolon()
              .match(code)
              .map(function (n) { return n.captures[0]; });
          return names.reduce(function (acc, name) {
              var results = matcher().literal(name).dot().literal("height").match(acc);
              return results.reduce(function (acc, result) {
                  return acc.replace(result.literal, "nc_uniform_" + name + "_height");
              }, acc);
          }, code);
      };
      exports.replace_float3D_uniform = function (code) {
          var results = matcher()
              .literal("uniform")
              .space_mandated()
              .literal("Float3D")
              .space_mandated()
              .capture(matcher().alphanumeric())
              .space_optional()
              .semicolon()
              .match(code);
          return results.reduce(function (acc, result) {
              var replacement = ["\n"];
              replacement.push("uniform sampler2D nc_uniform_" + result.captures[0] + "_texture;");
              replacement.push("uniform int       nc_uniform_" + result.captures[0] + "_textureWidth;");
              replacement.push("uniform int       nc_uniform_" + result.captures[0] + "_textureHeight;");
              replacement.push("uniform int       nc_uniform_" + result.captures[0] + "_width;");
              replacement.push("uniform int       nc_uniform_" + result.captures[0] + "_height;");
              replacement.push("uniform int       nc_uniform_" + result.captures[0] + "_depth;");
              return acc.replace(result.literal, replacement.join("\n"));
          }, code);
      };
      exports.replace_float3D_indexer = function (code) {
          var names = matcher()
              .literal("uniform")
              .space_mandated()
              .literal("Float3D")
              .space_mandated()
              .capture(matcher().alphanumeric())
              .space_optional()
              .semicolon()
              .match(code)
              .map(function (n) { return n.captures[0]; });
          return names.reduce(function (acc, name) {
              var results = matcher()
                  .literal(name)
                  .space_optional()
                  .bracket_open()
                  .capture(matcher().codeblock())
                  .bracket_close()
                  .space_optional()
                  .bracket_open()
                  .capture(matcher().codeblock())
                  .bracket_close()
                  .space_optional()
                  .bracket_open()
                  .capture(matcher().codeblock())
                  .bracket_close()
                  .match(acc);
              return results.reduce(function (acc, result) {
                  return acc.replace(result.literal, "nc_decode(\n          texture( \n            nc_uniform_" + name + "_texture,\n            nc_select_3D (\n              nc_uniform_" + name + "_textureWidth,\n              nc_uniform_" + name + "_textureHeight,\n              nc_uniform_" + name + "_width,\n              nc_uniform_" + name + "_height,\n              nc_uniform_" + name + "_depth,\n              " + result.captures[0] + ",\n              " + result.captures[1] + ",\n              " + result.captures[2] + "\n            )\n          )\n        )");
              }, acc);
          }, code);
      };
      exports.replace_float3D_width = function (code) {
          var names = matcher()
              .literal("uniform")
              .space_mandated()
              .literal("Float3D")
              .space_mandated()
              .capture(matcher().alphanumeric())
              .space_optional()
              .semicolon()
              .match(code)
              .map(function (n) { return n.captures[0]; });
          return names.reduce(function (acc, name) {
              var results = matcher().literal(name).dot().literal("width").match(acc);
              return results.reduce(function (acc, result) {
                  return acc.replace(result.literal, "nc_uniform_" + name + "_width");
              }, acc);
          }, code);
      };
      exports.replace_float3D_height = function (code) {
          var names = matcher()
              .literal("uniform")
              .space_mandated()
              .literal("Float3D")
              .space_mandated()
              .capture(matcher().alphanumeric())
              .space_optional()
              .semicolon()
              .match(code)
              .map(function (n) { return n.captures[0]; });
          return names.reduce(function (acc, name) {
              var results = matcher().literal(name).dot().literal("height").match(acc);
              return results.reduce(function (acc, result) {
                  return acc.replace(result.literal, "nc_uniform_" + name + "_height");
              }, acc);
          }, code);
      };
      exports.replace_float3D_depth = function (code) {
          var names = matcher()
              .literal("uniform")
              .space_mandated()
              .literal("Float3D")
              .space_mandated()
              .capture(matcher().alphanumeric())
              .space_optional()
              .semicolon()
              .match(code)
              .map(function (n) { return n.captures[0]; });
          return names.reduce(function (acc, name) {
              var results = matcher().literal(name).dot().literal("depth").match(acc);
              return results.reduce(function (acc, result) {
                  return acc.replace(result.literal, "nc_uniform_" + name + "_depth");
              }, acc);
          }, code);
      };
      exports.replace_color1D_uniform = function (code) {
          var results = matcher()
              .literal("uniform")
              .space_mandated()
              .literal("Color1D")
              .space_mandated()
              .capture(matcher().alphanumeric())
              .space_optional()
              .semicolon()
              .match(code);
          return results.reduce(function (acc, result) {
              var replacement = ["\n"];
              replacement.push("uniform sampler2D nc_uniform_" + result.captures[0] + "_texture;");
              replacement.push("uniform int       nc_uniform_" + result.captures[0] + "_textureWidth;");
              replacement.push("uniform int       nc_uniform_" + result.captures[0] + "_textureHeight;");
              replacement.push("uniform int       nc_uniform_" + result.captures[0] + "_width;");
              return acc.replace(result.literal, replacement.join("\n"));
          }, code);
      };
      exports.replace_color1D_indexer = function (code) {
          var names = matcher()
              .literal("uniform")
              .space_mandated()
              .literal("Color1D")
              .space_mandated()
              .capture(matcher().alphanumeric())
              .space_optional()
              .semicolon()
              .match(code)
              .map(function (n) { return n.captures[0]; });
          return names.reduce(function (acc, name) {
              var results = matcher()
                  .literal(name)
                  .space_optional()
                  .bracket_open()
                  .capture(matcher().codeblock())
                  .bracket_close()
                  .match(acc);
              return results.reduce(function (acc, result) {
                  return acc.replace(result.literal, "texture( \n        nc_uniform_" + name + "_texture,\n        nc_select_1D (\n          nc_uniform_" + name + "_textureWidth,\n          nc_uniform_" + name + "_textureHeight,\n          nc_uniform_" + name + "_width,\n          " + result.captures[0] + "\n        )\n      )");
              }, acc);
          }, code);
      };
      exports.replace_color1D_width = function (code) {
          var names = matcher()
              .literal("uniform")
              .space_mandated()
              .literal("Color1D")
              .space_mandated()
              .capture(matcher().alphanumeric())
              .space_optional()
              .semicolon()
              .match(code)
              .map(function (n) { return n.captures[0]; });
          return names.reduce(function (acc, name) {
              var results = matcher().literal(name).dot().literal("width").match(acc);
              return results.reduce(function (acc, result) {
                  return acc.replace(result.literal, "nc_uniform_" + name + "_width");
              }, acc);
          }, code);
      };
      exports.replace_color2D_uniform = function (code) {
          var results = matcher()
              .literal("uniform")
              .space_mandated()
              .literal("Color2D")
              .space_mandated()
              .capture(matcher().alphanumeric())
              .space_optional()
              .semicolon()
              .match(code);
          return results.reduce(function (acc, result) {
              var replacement = ["\n"];
              replacement.push("uniform sampler2D nc_uniform_" + result.captures[0] + "_texture;");
              replacement.push("uniform int       nc_uniform_" + result.captures[0] + "_textureWidth;");
              replacement.push("uniform int       nc_uniform_" + result.captures[0] + "_textureHeight;");
              replacement.push("uniform int       nc_uniform_" + result.captures[0] + "_width;");
              replacement.push("uniform int       nc_uniform_" + result.captures[0] + "_height;");
              return acc.replace(result.literal, replacement.join("\n"));
          }, code);
      };
      exports.replace_color2D_indexer = function (code) {
          var names = matcher()
              .literal("uniform")
              .space_mandated()
              .literal("Color2D")
              .space_mandated()
              .capture(matcher().alphanumeric())
              .space_optional()
              .semicolon()
              .match(code)
              .map(function (n) { return n.captures[0]; });
          return names.reduce(function (acc, name) {
              var results = matcher()
                  .literal(name)
                  .space_optional()
                  .bracket_open()
                  .capture(matcher().codeblock())
                  .bracket_close()
                  .space_optional()
                  .bracket_open()
                  .capture(matcher().codeblock())
                  .bracket_close()
                  .match(acc);
              return results.reduce(function (acc, result) {
                  return acc.replace(result.literal, "texture( \n        nc_uniform_" + name + "_texture,\n        nc_select_2D (\n          nc_uniform_" + name + "_textureWidth,\n          nc_uniform_" + name + "_textureHeight,\n          nc_uniform_" + name + "_width,\n          nc_uniform_" + name + "_height,\n          " + result.captures[0] + ",\n          " + result.captures[1] + "\n        )\n      )");
              }, acc);
          }, code);
      };
      exports.replace_color2D_width = function (code) {
          var names = matcher()
              .literal("uniform")
              .space_mandated()
              .literal("Color2D")
              .space_mandated()
              .capture(matcher().alphanumeric())
              .space_optional()
              .semicolon()
              .match(code)
              .map(function (n) { return n.captures[0]; });
          return names.reduce(function (acc, name) {
              var results = matcher().literal(name).dot().literal("width").match(acc);
              return results.reduce(function (acc, result) {
                  return acc.replace(result.literal, "nc_uniform_" + name + "_width");
              }, acc);
          }, code);
      };
      exports.replace_color2D_height = function (code) {
          var names = matcher()
              .literal("uniform")
              .space_mandated()
              .literal("Color2D")
              .space_mandated()
              .capture(matcher().alphanumeric())
              .space_optional()
              .semicolon()
              .match(code)
              .map(function (n) { return n.captures[0]; });
          return names.reduce(function (acc, name) {
              var results = matcher().literal(name).dot().literal("height").match(acc);
              return results.reduce(function (acc, result) {
                  return acc.replace(result.literal, "nc_uniform_" + name + "_height");
              }, acc);
          }, code);
      };
      exports.replace_color3D_uniform = function (code) {
          var results = matcher()
              .literal("uniform")
              .space_mandated()
              .literal("Color3D")
              .space_mandated()
              .capture(matcher().alphanumeric())
              .space_optional()
              .semicolon()
              .match(code);
          return results.reduce(function (acc, result) {
              var replacement = ["\n"];
              replacement.push("uniform sampler2D nc_uniform_" + result.captures[0] + "_texture;");
              replacement.push("uniform int       nc_uniform_" + result.captures[0] + "_textureWidth;");
              replacement.push("uniform int       nc_uniform_" + result.captures[0] + "_textureHeight;");
              replacement.push("uniform int       nc_uniform_" + result.captures[0] + "_width;");
              replacement.push("uniform int       nc_uniform_" + result.captures[0] + "_height;");
              replacement.push("uniform int       nc_uniform_" + result.captures[0] + "_depth;");
              return acc.replace(result.literal, replacement.join("\n"));
          }, code);
      };
      exports.replace_color3D_indexer = function (code) {
          var names = matcher()
              .literal("uniform")
              .space_mandated()
              .literal("Color3D")
              .space_mandated()
              .capture(matcher().alphanumeric())
              .space_optional()
              .semicolon()
              .match(code)
              .map(function (n) { return n.captures[0]; });
          return names.reduce(function (acc, name) {
              var results = matcher()
                  .literal(name)
                  .space_optional()
                  .bracket_open()
                  .capture(matcher().codeblock())
                  .bracket_close()
                  .space_optional()
                  .bracket_open()
                  .capture(matcher().codeblock())
                  .bracket_close()
                  .space_optional()
                  .bracket_open()
                  .capture(matcher().codeblock())
                  .bracket_close()
                  .match(acc);
              return results.reduce(function (acc, result) {
                  return acc.replace(result.literal, "texture( \n          nc_uniform_" + name + "_texture,\n          nc_select_3D (\n            nc_uniform_" + name + "_textureWidth,\n            nc_uniform_" + name + "_textureHeight,\n            nc_uniform_" + name + "_width,\n            nc_uniform_" + name + "_height,\n            nc_uniform_" + name + "_depth,\n            " + result.captures[0] + ",\n            " + result.captures[1] + ",\n            " + result.captures[2] + "\n          )\n        )");
              }, acc);
          }, code);
      };
      exports.replace_color3D_width = function (code) {
          var names = matcher()
              .literal("uniform")
              .space_mandated()
              .literal("Color3D")
              .space_mandated()
              .capture(matcher().alphanumeric())
              .space_optional()
              .semicolon()
              .match(code)
              .map(function (n) { return n.captures[0]; });
          return names.reduce(function (acc, name) {
              var results = matcher().literal(name).dot().literal("width").match(acc);
              return results.reduce(function (acc, result) {
                  return acc.replace(result.literal, "nc_uniform_" + name + "_width");
              }, acc);
          }, code);
      };
      exports.replace_color3D_height = function (code) {
          var names = matcher()
              .literal("uniform")
              .space_mandated()
              .literal("Color3D")
              .space_mandated()
              .capture(matcher().alphanumeric())
              .space_optional()
              .semicolon()
              .match(code)
              .map(function (n) { return n.captures[0]; });
          return names.reduce(function (acc, name) {
              var results = matcher().literal(name).dot().literal("height").match(acc);
              return results.reduce(function (acc, result) {
                  return acc.replace(result.literal, "nc_uniform_" + name + "_height");
              }, acc);
          }, code);
      };
      exports.replace_color3D_depth = function (code) {
          var names = matcher()
              .literal("uniform")
              .space_mandated()
              .literal("Color3D")
              .space_mandated()
              .capture(matcher().alphanumeric())
              .space_optional()
              .semicolon()
              .match(code)
              .map(function (n) { return n.captures[0]; });
          return names.reduce(function (acc, name) {
              var results = matcher().literal(name).dot().literal("depth").match(acc);
              return results.reduce(function (acc, result) {
                  return acc.replace(result.literal, "nc_uniform_" + name + "_depth");
              }, acc);
          }, code);
      };
      var endianness = (function () {
          var b = new ArrayBuffer(4);
          var a = new Uint32Array(b);
          var c = new Uint8Array(b);
          a[0] = 0xdeadbeef;
          if (c[0] === 0xef)
              return 'LE';
          if (c[0] === 0xde)
              return 'BE';
          throw new Error('unknown endianness');
      })();
      exports.get_thread_directives = function () { return [
          "#version 300 es",
          "precision highp float;",
          ""
      ].join("\n"); };
      exports.get_thread_integer_mod = function () { return [
          "vec2 nc_int_mod(vec2 x, float y) {",
          "  vec2 res = floor(mod(x, y));",
          "  return res * step(1.0 - floor(y), -res);",
          "}",
          "vec3 nc_int_mod(vec3 x, float y) {",
          "  vec3 res = floor(mod(x, y));",
          "  return res * step(1.0 - floor(y), -res);",
          "}",
          "vec4 nc_int_mod(vec4 x, vec4 y) {",
          "  vec4 res = floor(mod(x, y));",
          "  return res * step(1.0 - floor(y), -res);",
          "}",
          "highp float nc_int_mod(highp float x, highp float y) {",
          "  highp float res = floor(mod(x, y));",
          "  return res * (res > floor(y) - 1.0 ? 0.0 : 1.0);",
          "}",
          "highp int nc_int_mod(highp int x, highp int y) {",
          "  return int(nc_int_mod(float(x), float(y)));",
          "}",
          ""
      ].join("\n"); };
      exports.get_thread_encode_functions = function () { return [
          "const vec2 MAGIC_VEC        = vec2(1.0, -256.0);",
          "const vec4 SCALE_FACTOR     = vec4(1.0, 256.0, 65536.0, 0.0);",
          "const vec4 SCALE_FACTOR_INV = vec4(1.0, 0.00390625, 0.0000152587890625, 0.0); // 1, 1/256, 1/65536);",
          "",
          "highp float nc_decode(highp vec4 rgba) {",
          (endianness === "BE") ? " rgba.rgba = rgba.abgr;" : "",
          "  rgba *= 255.0;",
          "  vec2 gte128;",
          "  gte128.x = rgba.b >= 128.0 ? 1.0 : 0.0;",
          "  gte128.y = rgba.a >= 128.0 ? 1.0 : 0.0;",
          "  float exponent = 2.0 * rgba.a - 127.0 + dot(gte128, MAGIC_VEC);",
          "  float res = exp2(round(exponent));",
          "  rgba.b = rgba.b - 128.0 * gte128.x;",
          "  res = dot(rgba, SCALE_FACTOR) * exp2(round(exponent-23.0)) + res;",
          "  res *= gte128.y * -2.0 + 1.0;",
          "  return res;",
          "}",
          "",
          "highp vec4 nc_encode(highp float f) {",
          "  highp float F = abs(f);",
          "  highp float sign = f < 0.0 ? 1.0 : 0.0;",
          "  highp float exponent = floor(log2(F));",
          "  highp float mantissa = (exp2(-exponent) * F);",
          "  // exponent += floor(log2(mantissa));",
          "  vec4 rgba = vec4(F * exp2(23.0-exponent)) * SCALE_FACTOR_INV;",
          "  rgba.rg = nc_int_mod(rgba.rg, 256.0);",
          "  rgba.b = nc_int_mod(rgba.b, 128.0);",
          "  rgba.a = exponent*0.5 + 63.5;",
          "  rgba.ba += vec2(nc_int_mod(exponent+127.0, 2.0), sign) * 128.0;",
          "  rgba = floor(rgba);",
          "  rgba *= 0.003921569; // 1/255",
          (endianness === "BE") ? " rgba.rgba = rgba.abgr;" : "",
          "  return rgba;",
          "}",
          ""
      ].join("\n"); };
      exports.get_thread_select_functions = function () { return [
          "vec2 nc_select_1D (int textureWidth, int textureHeight, int width, int index_x) {",
          "  float x = float(index_x % textureWidth) + 0.5;",
          "  float y = float(index_x / textureWidth) + 0.5;",
          "  return vec2 (",
          "    x / float(textureWidth),",
          "    y / float(textureHeight)",
          ");",
          "}",
          "",
          "vec2 nc_select_2D (int textureWidth, int textureHeight, int width, int height, int index_x, int index_y) {",
          "  float mx = (1.0 / ( float(textureWidth ) ) );",
          "  float my = (1.0 / ( float(textureHeight) ) );",
          "  float x  = ( float(index_x) + 0.5) * mx;",
          "  float y  = ( float(index_y) + 0.5) * my;",
          "  return vec2(x, y);",
          "}",
          "",
          "vec2 nc_select_3D (int textureWidth, int textureHeight, int width, int height, int depth, int index_x, int index_y, int index_z) {",
          "  int i = index_x + (index_y * width) + (index_z * (width * height));",
          "  float x = float(i % textureWidth) + 0.5;",
          "  float y = float(i / textureWidth) + 0.5;",
          "  return vec2 (",
          "    x / float(textureWidth),",
          "    y / float(textureHeight)",
          ");",
          "}",
          ""
      ].join("\n"); };
      exports.get_thread_uniforms = function () { return [
          "uniform int   nc_thread_viewport_width;",
          "uniform int   nc_thread_viewport_height;",
          "",
          "uniform int   nc_thread_output_width;",
          "uniform int   nc_thread_output_height;",
          "uniform int   nc_thread_output_depth;",
          "",
          "in      vec2  nc_thread_uv;",
          ""
      ].join("\n"); };
      exports.get_thread_output_register = function (thread) {
          return thread.outputs.reduce(function (acc, output, index) {
              return acc + ("layout(location = " + index + ") out vec4 nc_thread_output_" + index + ";\n");
          }, "") + "\n";
      };
      exports.get_thread_main = function (thread) {
          var buffer = [];
          switch (thread.indexing) {
              case "1D":
                  buffer.push("void main() {");
                  buffer.push("  int x = int( nc_thread_uv.x * float( nc_thread_viewport_width  ) );");
                  buffer.push("  int y = int( nc_thread_uv.y * float( nc_thread_viewport_height ) );");
                  buffer.push("  int ix = x + ( y * nc_thread_viewport_width );");
                  buffer.push("  ");
                  buffer.push("  thread (ix);");
                  break;
              case "2D":
                  buffer.push("void main() {");
                  buffer.push("  int ix = int( nc_thread_uv.x * float ( nc_thread_viewport_width  ) );");
                  buffer.push("  int iy = int( nc_thread_uv.y * float ( nc_thread_viewport_height ) );");
                  buffer.push("  thread(ix, iy);");
                  break;
              case "3D":
                  buffer.push("void main() {");
                  buffer.push("  int x  = int( nc_thread_uv.x * float ( nc_thread_viewport_width  ) );");
                  buffer.push("  int y  = int( nc_thread_uv.y * float ( nc_thread_viewport_height ) );");
                  buffer.push("  int i  = x + ( y * nc_thread_viewport_width );");
                  buffer.push("");
                  buffer.push("  int ix = ( i / ( 1                                               ) ) % nc_thread_output_width;");
                  buffer.push("  int iy = ( i / ( nc_thread_output_width                          ) ) % nc_thread_output_height;");
                  buffer.push("  int iz = ( i / ( nc_thread_output_width * nc_thread_output_height) ) % nc_thread_output_depth;");
                  buffer.push("  thread(ix, iy, iz);");
                  break;
          }
          if (thread.indexing !== "error") {
              thread.outputs.forEach(function (output, index) {
                  switch (output) {
                      case "float":
                          buffer.push("  nc_thread_output_" + index + " = nc_encode(nc_thread_output_" + index + ".r);");
                          break;
                  }
              });
              buffer.push("}");
          }
          return buffer.join("\n");
      };
      exports.get_vertex_program = function () { return [
          "#version 300 es",
          "precision highp float;",
          "",
          "in  vec3 nc_thread_position;",
          "in  vec2 nc_thread_texcoord;",
          "out vec2 nc_thread_uv;",
          "",
          "void main() {",
          "  nc_thread_uv  = nc_thread_texcoord;",
          "",
          "  gl_Position = vec4 (",
          "    nc_thread_position.x,",
          "    nc_thread_position.y,",
          "    nc_thread_position.z,",
          "    1.0);",
          "}"
      ].join("\n"); };
      exports.transform = function (code) {
          code = code.split("\n").map(function (line) {
              var index = line.indexOf("//");
              return (index !== -1)
                  ? line.slice(0, index)
                  : line;
          }).join("\n");
          var thread = exports.read_program_thread_function(code);
          var uniforms = exports.read_program_uniforms(code);
          if (thread.indexing === "error") {
              throw Error("program is invalid.");
          }
          code = exports.replace_float1D_indexer(code);
          code = exports.replace_float1D_width(code);
          code = exports.replace_float1D_uniform(code);
          code = exports.replace_float2D_indexer(code);
          code = exports.replace_float2D_width(code);
          code = exports.replace_float2D_height(code);
          code = exports.replace_float2D_uniform(code);
          code = exports.replace_float3D_indexer(code);
          code = exports.replace_float3D_width(code);
          code = exports.replace_float3D_height(code);
          code = exports.replace_float3D_depth(code);
          code = exports.replace_float3D_uniform(code);
          code = exports.replace_color1D_indexer(code);
          code = exports.replace_color1D_width(code);
          code = exports.replace_color1D_uniform(code);
          code = exports.replace_color2D_indexer(code);
          code = exports.replace_color2D_width(code);
          code = exports.replace_color2D_height(code);
          code = exports.replace_color2D_uniform(code);
          code = exports.replace_color3D_indexer(code);
          code = exports.replace_color3D_width(code);
          code = exports.replace_color3D_height(code);
          code = exports.replace_color3D_depth(code);
          code = exports.replace_color3D_uniform(code);
          code = exports.replace_thread_output_indexer(code);
          code = exports.replace_thread_output_dimensions(code);
          code = exports.replace_thread_signature(code);
          var fragment = [
              exports.get_thread_directives(),
              exports.get_thread_uniforms(),
              exports.get_thread_output_register(thread),
              exports.get_thread_integer_mod(),
              exports.get_thread_encode_functions(),
              exports.get_thread_select_functions(),
              code,
              exports.get_thread_main(thread)
          ].join("\n");
          return {
              thread: thread,
              uniforms: uniforms,
              vertex: exports.get_vertex_program(),
              fragment: fragment
          };
      };
  });
  define("gpu/program", ["require", "exports", "gpu/script"], function (require, exports, script_1) {
      "use strict";
      exports.__esModule = true;
      var Program = (function () {
          function Program(context, framebuf, plane, source) {
              this.context = context;
              this.framebuf = framebuf;
              this.plane = plane;
              this.script = script_1.transform(source);
              this.compile();
          }
          Program.prototype.compile = function () {
              var _this = this;
              this.program = this.context.createProgram();
              this.vertexshader = this.context.createShader(this.context.VERTEX_SHADER);
              this.context.shaderSource(this.vertexshader, this.script.vertex);
              this.context.compileShader(this.vertexshader);
              if (this.context.getShaderParameter(this.vertexshader, this.context.COMPILE_STATUS) === false) {
                  var error = this.context.getShaderInfoLog(this.vertexshader);
                  this.context.deleteShader(this.vertexshader);
                  throw new Error(error);
              }
              this.fragmentshader = this.context.createShader(this.context.FRAGMENT_SHADER);
              this.context.shaderSource(this.fragmentshader, this.script.fragment);
              this.context.compileShader(this.fragmentshader);
              if (this.context.getShaderParameter(this.fragmentshader, this.context.COMPILE_STATUS) === false) {
                  var error = this.context.getShaderInfoLog(this.fragmentshader);
                  this.context.deleteShader(this.fragmentshader);
                  throw new Error(error);
              }
              this.context.attachShader(this.program, this.vertexshader);
              this.context.attachShader(this.program, this.fragmentshader);
              this.context.linkProgram(this.program);
              this.cache = { attributes: {}, uniforms: {} };
              this.cache.attributes["nc_thread_position"] = this.context.getAttribLocation(this.program, "nc_thread_position");
              this.cache.attributes["nc_thread_texcoord"] = this.context.getAttribLocation(this.program, "nc_thread_texcoord");
              this.cache.uniforms["nc_thread_viewport_width"] = this.context.getUniformLocation(this.program, "nc_thread_viewport_width");
              this.cache.uniforms["nc_thread_viewport_height"] = this.context.getUniformLocation(this.program, "nc_thread_viewport_height");
              this.cache.uniforms["nc_thread_output_width"] = this.context.getUniformLocation(this.program, "nc_thread_output_width");
              this.cache.uniforms["nc_thread_output_height"] = this.context.getUniformLocation(this.program, "nc_thread_output_height");
              this.cache.uniforms["nc_thread_output_depth"] = this.context.getUniformLocation(this.program, "nc_thread_output_depth");
              this.script.uniforms.forEach(function (script_uniform) {
                  switch (script_uniform.type) {
                      case "float":
                      case "vec2":
                      case "vec3":
                      case "vec4":
                      case "int":
                      case "ivec2":
                      case "ivec3":
                      case "ivec4":
                      case "mat3":
                      case "mat4": {
                          _this.cache.uniforms[script_uniform.name] = _this.context.getUniformLocation(_this.program, script_uniform.name);
                          break;
                      }
                      case "Color1D":
                      case "Float1D": {
                          _this.cache.uniforms["nc_uniform_" + script_uniform.name + "_texture"] = _this.context.getUniformLocation(_this.program, "nc_uniform_" + script_uniform.name + "_texture");
                          _this.cache.uniforms["nc_uniform_" + script_uniform.name + "_textureWidth"] = _this.context.getUniformLocation(_this.program, "nc_uniform_" + script_uniform.name + "_textureWidth");
                          _this.cache.uniforms["nc_uniform_" + script_uniform.name + "_textureHeight"] = _this.context.getUniformLocation(_this.program, "nc_uniform_" + script_uniform.name + "_textureHeight");
                          _this.cache.uniforms["nc_uniform_" + script_uniform.name + "_width"] = _this.context.getUniformLocation(_this.program, "nc_uniform_" + script_uniform.name + "_width");
                          break;
                      }
                      case "Color2D":
                      case "Float2D": {
                          _this.cache.uniforms["nc_uniform_" + script_uniform.name + "_texture"] = _this.context.getUniformLocation(_this.program, "nc_uniform_" + script_uniform.name + "_texture");
                          _this.cache.uniforms["nc_uniform_" + script_uniform.name + "_textureWidth"] = _this.context.getUniformLocation(_this.program, "nc_uniform_" + script_uniform.name + "_textureWidth");
                          _this.cache.uniforms["nc_uniform_" + script_uniform.name + "_textureHeight"] = _this.context.getUniformLocation(_this.program, "nc_uniform_" + script_uniform.name + "_textureHeight");
                          _this.cache.uniforms["nc_uniform_" + script_uniform.name + "_width"] = _this.context.getUniformLocation(_this.program, "nc_uniform_" + script_uniform.name + "_width");
                          _this.cache.uniforms["nc_uniform_" + script_uniform.name + "_height"] = _this.context.getUniformLocation(_this.program, "nc_uniform_" + script_uniform.name + "_height");
                          break;
                      }
                      case "Color3D":
                      case "Float3D": {
                          _this.cache.uniforms["nc_uniform_" + script_uniform.name + "_texture"] = _this.context.getUniformLocation(_this.program, "nc_uniform_" + script_uniform.name + "_texture");
                          _this.cache.uniforms["nc_uniform_" + script_uniform.name + "_textureWidth"] = _this.context.getUniformLocation(_this.program, "nc_uniform_" + script_uniform.name + "_textureWidth");
                          _this.cache.uniforms["nc_uniform_" + script_uniform.name + "_textureHeight"] = _this.context.getUniformLocation(_this.program, "nc_uniform_" + script_uniform.name + "_textureHeight");
                          _this.cache.uniforms["nc_uniform_" + script_uniform.name + "_width"] = _this.context.getUniformLocation(_this.program, "nc_uniform_" + script_uniform.name + "_width");
                          _this.cache.uniforms["nc_uniform_" + script_uniform.name + "_height"] = _this.context.getUniformLocation(_this.program, "nc_uniform_" + script_uniform.name + "_height");
                          _this.cache.uniforms["nc_uniform_" + script_uniform.name + "_depth"] = _this.context.getUniformLocation(_this.program, "nc_uniform_" + script_uniform.name + "_depth");
                          break;
                      }
                  }
              });
          };
          Program.prototype.execute = function (outputs, uniforms) {
              var _this = this;
              var typecheck = this.typecheck(outputs, uniforms);
              if (!typecheck.success) {
                  console.warn(typecheck.errors.join("\n"));
                  throw Error("unable to execute.");
              }
              this.context.bindFramebuffer(this.context.FRAMEBUFFER, this.framebuf);
              this.context.drawBuffers(outputs.map(function (output, index) { return _this.context.COLOR_ATTACHMENT0 + index; }));
              outputs.forEach(function (output, index) {
                  _this.context.framebufferTexture2D(_this.context.FRAMEBUFFER, _this.context.COLOR_ATTACHMENT0 + index, _this.context.TEXTURE_2D, output.texture, 0);
                  if (!(_this.context.checkFramebufferStatus(_this.context.FRAMEBUFFER) === _this.context.FRAMEBUFFER_COMPLETE)) {
                      console.warn("unable to attach output[" + index + "] as render target.");
                      return;
                  }
              });
              this.context.useProgram(this.program);
              var output = outputs[0];
              switch (output.type) {
                  case "Float1D":
                  case "Color1D":
                      this.context.viewport(0, 0, output.textureWidth, output.textureHeight);
                      this.context.uniform1i(this.cache.uniforms["nc_thread_viewport_width"], output.textureWidth);
                      this.context.uniform1i(this.cache.uniforms["nc_thread_viewport_height"], output.textureHeight);
                      this.context.uniform1i(this.cache.uniforms["nc_thread_output_width"], output.width);
                      break;
                  case "Float2D":
                  case "Color2D":
                      this.context.viewport(0, 0, output.textureWidth, output.textureHeight);
                      this.context.uniform1i(this.cache.uniforms["nc_thread_viewport_width"], output.textureWidth);
                      this.context.uniform1i(this.cache.uniforms["nc_thread_viewport_height"], output.textureHeight);
                      this.context.uniform1i(this.cache.uniforms["nc_thread_output_width"], output.width);
                      this.context.uniform1i(this.cache.uniforms["nc_thread_output_height"], output.height);
                      break;
                  case "Float3D":
                  case "Color3D":
                      this.context.viewport(0, 0, output.textureWidth, output.textureHeight);
                      this.context.uniform1i(this.cache.uniforms["nc_thread_viewport_width"], output.textureWidth);
                      this.context.uniform1i(this.cache.uniforms["nc_thread_viewport_height"], output.textureHeight);
                      this.context.uniform1i(this.cache.uniforms["nc_thread_output_width"], output.width);
                      this.context.uniform1i(this.cache.uniforms["nc_thread_output_height"], output.height);
                      this.context.uniform1i(this.cache.uniforms["nc_thread_output_depth"], output.depth);
                      break;
              }
              var texture_index = 0;
              this.script.uniforms.forEach(function (script_uniform) {
                  if (uniforms[script_uniform.name] === undefined)
                      return;
                  switch (script_uniform.type) {
                      case "float": {
                          _this.context.uniform1f(_this.cache.uniforms[script_uniform.name], uniforms[script_uniform.name]);
                          break;
                      }
                      case "vec2": {
                          var v = uniforms[script_uniform.name];
                          _this.context.uniform2f(_this.cache.uniforms[script_uniform.name], v[0], v[1]);
                          break;
                      }
                      case "vec3": {
                          var v = uniforms[script_uniform.name];
                          _this.context.uniform3f(_this.cache.uniforms[script_uniform.name], v[0], v[1], v[2]);
                          break;
                      }
                      case "vec4": {
                          var v = uniforms[script_uniform.name];
                          _this.context.uniform4f(_this.cache.uniforms[script_uniform.name], v[0], v[1], v[2], v[3]);
                          break;
                      }
                      case "int": {
                          _this.context.uniform1i(_this.cache.uniforms[script_uniform.name], uniforms[script_uniform.name]);
                          break;
                      }
                      case "ivec2": {
                          var v = uniforms[script_uniform.name];
                          _this.context.uniform2i(_this.cache.uniforms[script_uniform.name], v[0], v[1]);
                          break;
                      }
                      case "ivec3": {
                          var v = uniforms[script_uniform.name];
                          _this.context.uniform3i(_this.cache.uniforms[script_uniform.name], v[0], v[1], v[2]);
                          break;
                      }
                      case "ivec4": {
                          var v = uniforms[script_uniform.name];
                          _this.context.uniform4i(_this.cache.uniforms[script_uniform.name], v[0], v[1], v[2], v[3]);
                          break;
                      }
                      case "mat3": {
                          var v = new Float32Array(uniforms[script_uniform.name]);
                          _this.context.uniformMatrix3fv(_this.cache.uniforms[script_uniform.name], false, v);
                          break;
                      }
                      case "mat4": {
                          var v = new Float32Array(uniforms[script_uniform.name]);
                          _this.context.uniformMatrix4fv(_this.cache.uniforms[script_uniform.name], false, v);
                          break;
                      }
                      case "Color1D":
                      case "Float1D": {
                          var data = uniforms[script_uniform.name];
                          if (_this.cache.uniforms["nc_uniform_" + script_uniform.name + "_textureWidth"]) {
                              _this.context.uniform1i(_this.cache.uniforms["nc_uniform_" + script_uniform.name + "_textureWidth"], data.textureWidth);
                          }
                          if (_this.cache.uniforms["nc_uniform_" + script_uniform.name + "_textureHeight"]) {
                              _this.context.uniform1i(_this.cache.uniforms["nc_uniform_" + script_uniform.name + "_textureHeight"], data.textureHeight);
                          }
                          if (_this.cache.uniforms["nc_uniform_" + script_uniform.name + "_width"]) {
                              _this.context.uniform1i(_this.cache.uniforms["nc_uniform_" + script_uniform.name + "_width"], data.width);
                          }
                          if (_this.cache.uniforms["nc_uniform_" + script_uniform.name + "_texture"]) {
                              _this.context.uniform1i(_this.cache.uniforms["nc_uniform_" + script_uniform.name + "_texture"], texture_index);
                              _this.context.activeTexture(_this.context.TEXTURE0 + texture_index);
                              _this.context.bindTexture(_this.context.TEXTURE_2D, data.texture);
                              texture_index += 1;
                          }
                          break;
                      }
                      case "Color2D":
                      case "Float2D": {
                          var data = uniforms[script_uniform.name];
                          if (_this.cache.uniforms["nc_uniform_" + script_uniform.name + "_textureWidth"]) {
                              _this.context.uniform1i(_this.cache.uniforms["nc_uniform_" + script_uniform.name + "_textureWidth"], data.textureWidth);
                          }
                          if (_this.cache.uniforms["nc_uniform_" + script_uniform.name + "_textureHeight"]) {
                              _this.context.uniform1i(_this.cache.uniforms["nc_uniform_" + script_uniform.name + "_textureHeight"], data.textureHeight);
                          }
                          if (_this.cache.uniforms["nc_uniform_" + script_uniform.name + "_width"]) {
                              _this.context.uniform1i(_this.cache.uniforms["nc_uniform_" + script_uniform.name + "_width"], data.width);
                          }
                          if (_this.cache.uniforms["nc_uniform_" + script_uniform.name + "_height"]) {
                              _this.context.uniform1i(_this.cache.uniforms["nc_uniform_" + script_uniform.name + "_height"], data.height);
                          }
                          if (_this.cache.uniforms["nc_uniform_" + script_uniform.name + "_texture"]) {
                              _this.context.uniform1i(_this.cache.uniforms["nc_uniform_" + script_uniform.name + "_texture"], texture_index);
                              _this.context.activeTexture(_this.context.TEXTURE0 + texture_index);
                              _this.context.bindTexture(_this.context.TEXTURE_2D, data.texture);
                              texture_index += 1;
                          }
                          break;
                      }
                      case "Color3D":
                      case "Float3D": {
                          var data = uniforms[script_uniform.name];
                          if (_this.cache.uniforms["nc_uniform_" + script_uniform.name + "_textureWidth"]) {
                              _this.context.uniform1i(_this.cache.uniforms["nc_uniform_" + script_uniform.name + "_textureWidth"], data.textureWidth);
                          }
                          if (_this.cache.uniforms["nc_uniform_" + script_uniform.name + "_textureHeight"]) {
                              _this.context.uniform1i(_this.cache.uniforms["nc_uniform_" + script_uniform.name + "_textureHeight"], data.textureHeight);
                          }
                          if (_this.cache.uniforms["nc_uniform_" + script_uniform.name + "_width"]) {
                              _this.context.uniform1i(_this.cache.uniforms["nc_uniform_" + script_uniform.name + "_width"], data.width);
                          }
                          if (_this.cache.uniforms["nc_uniform_" + script_uniform.name + "_height"]) {
                              _this.context.uniform1i(_this.cache.uniforms["nc_uniform_" + script_uniform.name + "_height"], data.height);
                          }
                          if (_this.cache.uniforms["nc_uniform_" + script_uniform.name + "_depth"]) {
                              _this.context.uniform1i(_this.cache.uniforms["nc_uniform_" + script_uniform.name + "_depth"], data.depth);
                          }
                          if (_this.cache.uniforms["nc_uniform_" + script_uniform.name + "_texture"]) {
                              _this.context.uniform1i(_this.cache.uniforms["nc_uniform_" + script_uniform.name + "_texture"], texture_index);
                              _this.context.activeTexture(_this.context.TEXTURE0 + texture_index);
                              _this.context.bindTexture(_this.context.TEXTURE_2D, data.texture);
                              texture_index += 1;
                          }
                          break;
                      }
                  }
              });
              this.context.bindBuffer(this.context.ARRAY_BUFFER, this.plane.position);
              this.context.enableVertexAttribArray(this.cache.attributes["nc_thread_position"]);
              this.context.vertexAttribPointer(this.cache.attributes["nc_thread_position"], 3, this.context.FLOAT, false, 0, 0);
              if (this.cache.attributes["nc_thread_texcoord"] !== -1) {
                  this.context.bindBuffer(this.context.ARRAY_BUFFER, this.plane.texcoord);
                  this.context.enableVertexAttribArray(this.cache.attributes["nc_thread_texcoord"]);
                  this.context.vertexAttribPointer(this.cache.attributes["nc_thread_texcoord"], 2, this.context.FLOAT, false, 0, 0);
              }
              this.context.bindBuffer(this.context.ELEMENT_ARRAY_BUFFER, this.plane.indices);
              this.context.drawElements(this.context.TRIANGLES, 6, this.context.UNSIGNED_SHORT, 0);
              outputs.forEach(function (_, index) {
                  _this.context.framebufferTexture2D(_this.context.FRAMEBUFFER, _this.context.COLOR_ATTACHMENT0 + index, _this.context.TEXTURE_2D, null, 0);
              });
              this.context.bindFramebuffer(this.context.FRAMEBUFFER, null);
          };
          Program.prototype.typecheck = function (outputs, uniforms) {
              var _this = this;
              var errors = [];
              if (this.script.thread.outputs.length !== outputs.length) {
                  errors.push("typecheck: expected " + this.script.thread.outputs.length + " outputs, " + outputs.length + " given.");
              }
              outputs.forEach(function (output, index) {
                  if (output.type.indexOf(_this.script.thread.indexing) === -1) {
                      errors.push("typecheck: a " + outputs[index].type + " is an invalid output for " + _this.script.thread.indexing + " indexed thread functions.");
                  }
              });
              if (!outputs.every(function (output) { return outputs[0].textureWidth === output.textureWidth && outputs[0].textureHeight === output.textureHeight; })) {
                  errors.push("typecheck: all output dimensions must be the same for all outputs.");
              }
              this.script.uniforms.forEach(function (script_uniform) {
                  if (uniforms[script_uniform.name] === undefined)
                      return;
                  var uniform = uniforms[script_uniform.name];
                  switch (script_uniform.type) {
                      case "int":
                      case "float":
                          if (typeof uniform !== "number")
                              errors.push("typecheck: " + script_uniform.name + " is invalid. Expected " + script_uniform.type + ".");
                          break;
                      case "Float1D":
                          if (uniform.type !== "Float1D")
                              errors.push("typecheck: uniform " + script_uniform.name + " is invalid. Expected " + script_uniform.type + ", got " + uniform.type + ".");
                          break;
                      case "Color1D":
                          if (uniform.type !== "Color1D")
                              errors.push("typecheck: uniform " + script_uniform.name + " is invalid. Expected " + script_uniform.type + ", got " + uniform.type + ".");
                          break;
                      case "Float2D":
                          if (uniform.type !== "Float2D")
                              errors.push("typecheck: uniform " + script_uniform.name + " is invalid. Expected " + script_uniform.type + ", got " + uniform.type + ".");
                          break;
                      case "Color2D":
                          if (uniform.type !== "Color2D")
                              errors.push("typecheck: uniform " + script_uniform.name + " is invalid. Expected " + script_uniform.type + ", got " + uniform.type + ".");
                          break;
                      case "Float3D":
                          if (uniform.type !== "Float3D")
                              errors.push("typecheck: uniform " + script_uniform.name + " is invalid. Expected " + script_uniform.type + ", got " + uniform.type + ".");
                          break;
                      case "Color3D":
                          if (uniform.type !== "Color3D")
                              errors.push("typecheck: uniform " + script_uniform.name + " is invalid. Expected " + script_uniform.type + ", got " + uniform.type + ".");
                          break;
                  }
              });
              return {
                  success: errors.length === 0,
                  errors: errors
              };
          };
          Program.prototype.dispose = function () {
              this.context.deleteShader(this.vertexshader);
              this.context.deleteShader(this.fragmentshader);
              this.context.deleteProgram(this.program);
          };
          return Program;
      }());
      exports.Program = Program;
  });
  define("gpu/present", ["require", "exports"], function (require, exports) {
      "use strict";
      exports.__esModule = true;
      var Present = (function () {
          function Present(context, plane) {
              this.context = context;
              this.plane = plane;
              this.program = this.context.createProgram();
              this.vertexshader = this.context.createShader(this.context.VERTEX_SHADER);
              this.context.shaderSource(this.vertexshader, [
                  "#version 300 es",
                  "precision highp float;",
                  "",
                  "in  vec3 nc_present_position;",
                  "in  vec2 nc_present_texcoord;",
                  "out vec2 nc_present_uv;",
                  "",
                  "void main() {",
                  "  nc_present_uv  = vec2(nc_present_texcoord.x, (-nc_present_texcoord.y) + 1.0);",
                  "",
                  "  gl_Position = vec4 (",
                  "    nc_present_position.x,",
                  "    nc_present_position.y,",
                  "    nc_present_position.z,",
                  "    1.0);",
                  "}"
              ].join("\n"));
              this.context.compileShader(this.vertexshader);
              if (this.context.getShaderParameter(this.vertexshader, this.context.COMPILE_STATUS) === false) {
                  console.warn(this.context.getShaderInfoLog(this.vertexshader));
                  this.context.deleteShader(this.vertexshader);
                  return;
              }
              this.fragmentshader = this.context.createShader(this.context.FRAGMENT_SHADER);
              this.context.shaderSource(this.fragmentshader, [
                  "#version 300 es",
                  "precision highp   float;",
                  "uniform sampler2D nc_present_texture;",
                  "in      vec2      nc_present_uv;",
                  "layout(location = 0) out vec4 nc_present_output;",
                  "",
                  "void main() {",
                  "  nc_present_output = texture(nc_present_texture, nc_present_uv);",
                  "}"
              ].join("\n"));
              this.context.compileShader(this.fragmentshader);
              if (this.context.getShaderParameter(this.fragmentshader, this.context.COMPILE_STATUS) === false) {
                  console.warn(this.context.getShaderInfoLog(this.fragmentshader));
                  this.context.deleteShader(this.fragmentshader);
                  return;
              }
              this.context.attachShader(this.program, this.vertexshader);
              this.context.attachShader(this.program, this.fragmentshader);
              this.context.linkProgram(this.program);
              this.cache = { attributes: {}, uniforms: {} };
              this.cache.attributes["nc_present_position"] = this.context.getAttribLocation(this.program, "nc_present_position");
              this.cache.attributes["nc_present_texcoord"] = this.context.getAttribLocation(this.program, "nc_present_texcoord");
              this.cache.uniforms["nc_present_texture"] = this.context.getUniformLocation(this.program, "nc_present_texture");
          }
          Present.prototype.present = function (buffer) {
              this.context.useProgram(this.program);
              this.context.uniform1i(this.cache.uniforms["nc_present_texture"], 0);
              this.context.activeTexture(this.context.TEXTURE0);
              this.context.bindTexture(this.context.TEXTURE_2D, buffer.texture);
              this.context.bindBuffer(this.context.ARRAY_BUFFER, this.plane.position);
              this.context.enableVertexAttribArray(this.cache.attributes["nc_present_position"]);
              this.context.vertexAttribPointer(this.cache.attributes["nc_present_position"], 3, this.context.FLOAT, false, 0, 0);
              if (this.cache.attributes["nc_present_texcoord"] !== -1) {
                  this.context.bindBuffer(this.context.ARRAY_BUFFER, this.plane.texcoord);
                  this.context.enableVertexAttribArray(this.cache.attributes["nc_present_texcoord"]);
                  this.context.vertexAttribPointer(this.cache.attributes["nc_present_texcoord"], 2, this.context.FLOAT, false, 0, 0);
              }
              this.context.bindBuffer(this.context.ELEMENT_ARRAY_BUFFER, this.plane.indices);
              this.context.drawElements(this.context.TRIANGLES, 6, this.context.UNSIGNED_SHORT, 0);
          };
          Present.prototype.dispose = function () {
              this.context.deleteShader(this.vertexshader);
              this.context.deleteShader(this.fragmentshader);
              this.context.deleteProgram(this.program);
          };
          return Present;
      }());
      exports.Present = Present;
  });
  define("gpu/context", ["require", "exports", "gpu/color", "gpu/float", "gpu/program", "gpu/plane", "gpu/present"], function (require, exports, color_1, float_1, program_1, plane_1, present_1) {
      "use strict";
      exports.__esModule = true;
      var Context = (function () {
          function Context(context) {
              if (context === void 0) { context = undefined; }
              this.context = context;
              if (context === undefined) {
                  var canvas = document.createElement("canvas");
                  this.context = canvas.getContext("webgl2", {
                      alpha: false,
                      depth: false,
                      antialias: false
                  });
              }
              this.framebuf = this.context.createFramebuffer();
              this.plane = new plane_1.Plane(this.context);
              this.present = new present_1.Present(this.context, this.plane);
          }
          Context.prototype.createProgram = function (source) {
              return new program_1.Program(this.context, this.framebuf, this.plane, source);
          };
          Context.prototype.createColor1D = function (length) {
              return new color_1.Color1D(this.context, this.framebuf, length);
          };
          Context.prototype.createColor2D = function (width, height) {
              return new color_1.Color2D(this.context, this.framebuf, width, height);
          };
          Context.prototype.createColor3D = function (width, height, depth) {
              return new color_1.Color3D(this.context, this.framebuf, width, height, depth);
          };
          Context.prototype.createFloat1D = function (length) {
              return new float_1.Float1D(this.context, this.framebuf, length);
          };
          Context.prototype.createFloat2D = function (width, height) {
              return new float_1.Float2D(this.context, this.framebuf, width, height);
          };
          Context.prototype.createFloat3D = function (width, height, depth) {
              return new float_1.Float3D(this.context, this.framebuf, width, height, depth);
          };
          Context.prototype.render = function (buffer) {
              this.present.present(buffer);
          };
          Context.prototype.dispose = function () {
              this.context.deleteFramebuffer(this.framebuf);
              this.present.dispose();
              this.plane.dispose();
          };
          return Context;
      }());
      exports.Context = Context;
  });
  define("gpu/index", ["require", "exports", "gpu/context", "gpu/program", "gpu/script", "gpu/float", "gpu/color"], function (require, exports, context_1, program_2, script_2, float_2, color_2) {
      "use strict";
      exports.__esModule = true;
      exports.Context = context_1.Context;
      exports.Program = program_2.Program;
      exports.transform = script_2.transform;
      exports.Float1D = float_2.Float1D;
      exports.Float2D = float_2.Float2D;
      exports.Float3D = float_2.Float3D;
      exports.Color1D = color_2.Color1D;
      exports.Color2D = color_2.Color2D;
      exports.Color3D = color_2.Color3D;
      exports.createContext = function (webgl2) { return new context_1.Context(webgl2); };
  });
  define("device/device", ["require", "exports", "gpu/index"], function (require, exports, index_1) {
      "use strict";
      exports.__esModule = true;
      var Device = (function () {
          function Device(canvas) {
              this.canvas = canvas;
              var options = { alpha: false, depth: false, antialias: false };
              this.webgl = this.canvas.getContext("webgl2", options);
              this.context = new index_1.Context(this.webgl);
              this.ready = false;
              this.outputs = [];
          }
          Device.prototype.getcontext = function () {
              return this.context;
          };
          Device.prototype.width = function () { return this.canvas.clientWidth; };
          Device.prototype.height = function () { return this.canvas.clientHeight; };
          Device.prototype.compile = function (code) {
              this.reset();
              return this.setup(code);
          };
          Device.prototype.present = function (uniforms) {
              if (this.ready) {
                  this.program.execute(this.outputs, uniforms);
                  this.context.render(this.outputs[0]);
              }
          };
          Device.prototype.setup = function (code) {
              try {
                  this.canvas.width = this.width();
                  this.canvas.height = this.height();
                  this.program = this.context.createProgram(code);
                  for (var i = 0; i < this.program.script.thread.outputs.length; i++) {
                      var output = this.context.createColor2D(this.width(), this.height()).push();
                      this.outputs.push(output);
                  }
                  this.ready = true;
                  return [];
              }
              catch (error) {
                  return [error.toString()];
              }
          };
          Device.prototype.reset = function () {
              if (this.ready) {
                  this.outputs.forEach(function (output) { return output.dispose(); });
                  this.outputs = [];
                  this.program.dispose();
              }
              this.ready = false;
          };
          Device.prototype.dispose = function () {
              this.reset();
              this.context.dispose();
          };
          return Device;
      }());
      exports.Device = Device;
  });
  define("device/index", ["require", "exports", "device/device"], function (require, exports, device_1) {
      "use strict";
      exports.__esModule = true;
      exports.Device = device_1.Device;
  });
  define("script/index", ["require", "exports"], function (require, exports) {
      "use strict";
      exports.__esModule = true;
      exports.resolve = function (context, code) {
          try {
              var func = new Function("context", "\n      " + code + "\n      function invoke () {\n        try {\n          return resolve()\n        } catch (error) {\n          return {}\n        }\n      }\n      return invoke;\n    ");
              return func(context);
          }
          catch (error) {
              return function () { return ({}); };
          }
      };
  });
  define("code", ["require", "exports"], function (require, exports) {
      "use strict";
      exports.__esModule = true;
      exports.demo_javascript = function () { return "const start = Date.now()\nconst time  = () => (Date.now() - start) * 0.001\n\nfunction resolve() {\n  return {\n    iGlobalTime: time()\n  }\n}\n"; };
      exports.demo_shader = function () { return "/**\n* Created by Kamil Kolaczynski (revers) - 2016\n*\n* Licensed under Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.\n*\n* This shader, as always, uses a lot of code (raymarching, noise and lighting) \n* credited to iq  [ https://www.shadertoy.com/view/Xds3zN ]. \n* Camera path is based on Shane's \"Subterranean Fly-Through\" \n* [ https://www.shadertoy.com/view/XlXXWj ].\n* Additional specular lighting trick is based on \"Wet stone\" by TDM \n* [ https://www.shadertoy.com/view/ldSSzV ].\n* Thanks for sharing great code guys!\n* The shader was created and exported from Synthclipse \n* [ http://synthclipse.sourceforge.net/ ].\n*/\n\nuniform float iGlobalTime;\n\nconst float FOV = 0.4;\nconst float MarchDumping = 0.7579;\nconst float Far = 38.925;\nconst int MaxSteps = 128;\nconst float CameraSpeed = 4.5099998;\nconst float TunnelSmoothFactor = 2.0;\nconst float TunnelRadius = 0.85660005;\nconst float TunnelFreqA = 0.18003;\nconst float TunnelFreqB = 0.25;\nconst float TunnelAmpA = 3.6230998;\nconst float TunnelAmpB = 2.4324;\nconst float NoiseIsoline = 0.319;\nconst float NoiseScale = 2.9980001;\nconst vec3 Color = vec3(0.85, 0.68, 0.4);\n\n#define M_NONE -1.0\n#define M_NOISE 1.0\n\nfloat hash(float h) {\n return fract(sin(h) * 43758.5453123);\n}\n\nfloat noise(vec3 x) {\n vec3 p = floor(x);\n vec3 f = fract(x);\n f = f * f * (3.0 - 2.0 * f);\n\n float n = p.x + p.y * 157.0 + 113.0 * p.z;\n return mix(\n     mix(mix(hash(n + 0.0), hash(n + 1.0), f.x),\n         mix(hash(n + 157.0), hash(n + 158.0), f.x), f.y),\n     mix(mix(hash(n + 113.0), hash(n + 114.0), f.x),\n         mix(hash(n + 270.0), hash(n + 271.0), f.x), f.y), f.z);\n}\n\nfloat fbm(vec3 p) {\n float f = 0.0;\n f = 0.5000 * noise(p);\n p *= 2.01;\n f += 0.2500 * noise(p);\n p *= 2.02;\n f += 0.1250 * noise(p);\n\n return f;\n}\n\n// by iq. http://iquilezles.org/www/articles/smin/smin.htm\nfloat smax(float a, float b, float k) {\n float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);\n return mix(a, b, h) + k * h * (1.0 - h);\n}\n\n// From \"Subterranean Fly-Through\" by Shane https://www.shadertoy.com/view/XlXXWj\nvec2 path(float z) {\n return vec2(TunnelAmpA * sin(z * TunnelFreqA), TunnelAmpB * cos(z * TunnelFreqB));\n}\n\nfloat noiseDist(vec3 p) {\n p = p / NoiseScale;\n return (fbm(p) - NoiseIsoline) * NoiseScale;\n}\n\nvec2 map(vec3 p) {\n float d = noiseDist(p);\n float d2 = length(p.xy - path(p.z)) - TunnelRadius;\n d = smax(d, -d2, TunnelSmoothFactor);\n\n vec2 res = vec2(d, M_NOISE);\n return res;\n}\n\nvec2 castRay(vec3 ro, vec3 rd) {\n float tmin = 0.0;\n float tmax = Far;\n\n float precis = 0.002;\n float t = tmin;\n float m = M_NONE;\n\n for (int i = 0; i < MaxSteps; i++) {\n   vec2 res = map(ro + rd * t);\n   if (res.x < precis || t > tmax) {\n     break;\n   }\n   t += res.x * MarchDumping;\n   m = res.y;\n }\n if (t > tmax) {\n   m = M_NONE;\n }\n return vec2(t, m);\n}\n\nfloat softshadow(vec3 ro, vec3 rd, float mint, float tmax) {\n float res = 1.0;\n float t = mint;\n for (int i = 0; i < 16; i++) {\n   float h = map(ro + rd * t).x;\n   res = min(res, 8.0 * h / t);\n   t += clamp(h, 0.02, 0.10);\n\n   if (h < 0.001 || t > tmax) {\n     break;\n   }\n }\n return clamp(res, 0.0, 1.0);\n}\n\nvec3 calcNormal(vec3 pos) {\n vec2 eps = vec2(0.001, 0.0);\n vec3 nor = vec3(map(pos + eps.xyy).x - map(pos - eps.xyy).x,\n     map(pos + eps.yxy).x - map(pos - eps.yxy).x,\n     map(pos + eps.yyx).x - map(pos - eps.yyx).x);\n return normalize(nor);\n}\n\nfloat calcAO(vec3 pos, vec3 nor) {\n float occ = 0.0;\n float sca = 1.0;\n\n for (int i = 0; i < 5; i++) {\n   float hr = 0.01 + 0.12 * float(i) / 4.0;\n   vec3 aopos = nor * hr + pos;\n   float dd = map(aopos).x;\n\n   occ += -(dd - hr) * sca;\n   sca *= 0.95;\n }\n return clamp(1.0 - 3.0 * occ, 0.0, 1.0);\n}\n\nvec3 render(vec3 ro, vec3 rd) {\n vec3 col = vec3(0.0);\n vec2 res = castRay(ro, rd);\n float t = res.x;\n float m = res.y;\n\n if (m > -0.5) {\n   vec3 pos = ro + t * rd;\n   vec3 nor = calcNormal(pos);\n\n   // material\n   col = Color + sin(t * 0.8) * 0.3;\n   col += 0.3 * sin(vec3(0.15, 0.02, 0.10) * iGlobalTime * 6.0);\n\n   // lighitng\n   float occ = calcAO(pos, nor);\n   vec3 lig = -rd;\n   float amb = clamp(0.5 + 0.5 * nor.y, 0.0, 1.0);\n   float dif = clamp(dot(nor, lig), 0.0, 1.0);\n\n   float fre = pow(clamp(1.0 + dot(nor, rd), 0.0, 1.0), 2.0);\n\n   vec3 ref = reflect(rd, nor);\n   float spe = pow(clamp(dot(ref, lig), 0.0, 1.0), 100.0);\n\n   dif *= softshadow(pos, lig, 0.02, 2.5);\n\n   vec3 brdf = vec3(0.0);\n   brdf += 1.20 * dif * vec3(1.00, 0.90, 0.60);\n   brdf += 1.20 * spe * vec3(1.00, 0.90, 0.60) * dif;\n\n   // Additional specular lighting trick,\n   // taken from \"Wet stone\" by TDM\n   // https://www.shadertoy.com/view/ldSSzV\n   nor = normalize(nor - normalize(pos) * 0.2);\n   ref = reflect(rd, nor);\n   spe = pow(clamp(dot(ref, lig), 0.0, 1.0), 100.0);\n   brdf += 2.20 * spe * vec3(1.00, 0.90, 0.60) * dif;\n\n   brdf += 0.40 * amb * vec3(0.50, 0.70, 1.00) * occ;\n   brdf += 0.40 * fre * vec3(1.00, 1.00, 1.00) * occ;\n\n   col = col * brdf;\n\n   col = mix(col, vec3(0.0), 1.0 - exp(-0.005 * t * t));\n }\n return vec3(clamp(col, 0.0, 1.0));\n}\n\nmat3 rotationZ(float a) {\n float sa = sin(a);\n float ca = cos(a);\n\n return mat3(ca, sa, 0.0, -sa, ca, 0.0, 0.0, 0.0, 1.0);\n}\n\nvec4 output0(int x, int y) {\n vec2 iResolution = vec2(float(thread.width), float(thread.height));\n vec2 fragCoord   = vec2(float(x), float(y));\n float t = iGlobalTime;\n vec2 r = iResolution;\n vec3 c;\n float l,z=t;\n for(int i=0;i<3;i++) {\n   vec2 uv,p=fragCoord.xy/r;\n   uv=p;\n   p-=.5;\n   p.x*=r.x/r.y;\n   z+=.07;\n   l=length(p);\n   uv+=p/l*(sin(z)+1.)*abs(sin(l*9.-z*2.));\n   c[i]=.01/length(abs(mod(uv,1.)-.5));\n }\n return vec4(c/l,t);\n}\n\nvec4 output1(int x, int y) {\n vec2 iResolution = vec2(float(thread.width), float(thread.height));\n vec2 fragCoord      = vec2(float(x), float(y));\n vec2 q = fragCoord / iResolution.xy;\n vec2 coord = 2.0 * q - 1.0;\n coord.x *= iResolution.x / iResolution.y;\n coord *= FOV;\n\n float t = iGlobalTime * CameraSpeed + 4.0 * 60.0;\n vec3 ro = vec3(path(t), t);\n\n t += 0.5;\n vec3 target = vec3(path(t), t);\n vec3 dir = normalize(target - ro);\n vec3 up = vec3(-0.9309864, -0.33987653, 0.1332234) * rotationZ(iGlobalTime * 0.05);\n vec3 upOrtho = normalize(up - dot(dir, up) * dir);\n vec3 right = normalize(cross(dir, upOrtho));\n\n vec3 rd = normalize(dir + coord.x * right + coord.y * upOrtho);\n\n vec3 col = render(ro, rd);\n\n col = pow(col, vec3(0.4545));\n\n return vec4(col, 1.0);\n}\n\n[color] thread(int x, int y) {\n  thread[0] = output1(x, y);\n}\n\n"; };
      exports.water_demo_javascript = function () { return "const start = Date.now()\nconst time  = () => (Date.now() - start) * 0.001\n\nfunction resolve() {\n  return {\n    iTime: time(),\n    iMouse: [1, 1]\n  }\n}\n"; };
      exports.water_demo_shader = function () { return "/*\n* \"Seascape\" by Alexander Alekseev aka TDM - 2014\n* License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.\n* Contact: tdmaav@gmail.com\n* \n* original work: https://www.shadertoy.com/view/Ms2SD1\n*/\n\nuniform float iTime;\nuniform vec2 iMouse;\n\nconst int NUM_STEPS = 8;\nconst float PI\t \t= 3.141592;\nconst float EPSILON\t= 1e-3;\n#define EPSILON_NRM (0.1 / float(thread.width))\n\n// sea\nconst int ITER_GEOMETRY    = 3;\nconst int ITER_FRAGMENT    = 5;\nconst float SEA_HEIGHT     = 0.6;\nconst float SEA_CHOPPY     = 4.0;\nconst float SEA_SPEED      = 0.8;\nconst float SEA_FREQ       = 0.16;\nconst vec3 SEA_BASE        = vec3(0.1,0.19,0.22);\nconst vec3 SEA_WATER_COLOR = vec3(0.8,0.9,0.6);\n#define SEA_TIME (1.0 + iTime * SEA_SPEED)\nconst mat2 octave_m = mat2(1.6,1.2,-1.2,1.6);\n\n// math\nmat3 fromEuler(vec3 ang) {\n vec2 a1 = vec2(sin(ang.x),cos(ang.x));\n   vec2 a2 = vec2(sin(ang.y),cos(ang.y));\n   vec2 a3 = vec2(sin(ang.z),cos(ang.z));\n   mat3 m;\n   m[0] = vec3(a1.y*a3.y+a1.x*a2.x*a3.x,a1.y*a2.x*a3.x+a3.y*a1.x,-a2.y*a3.x);\n m[1] = vec3(-a2.y*a1.x,a1.y*a2.y,a2.x);\n m[2] = vec3(a3.y*a1.x*a2.x+a1.y*a3.x,a1.x*a3.x-a1.y*a3.y*a2.x,a2.y*a3.y);\n return m;\n}\nfloat hash( vec2 p ) {\n float h = dot(p,vec2(127.1,311.7));\t\n   return fract(sin(h)*43758.5453123);\n}\nfloat noise( in vec2 p ) {\n   vec2 i = floor( p );\n   vec2 f = fract( p );\t\n vec2 u = f*f*(3.0-2.0*f);\n   return -1.0+2.0*mix( mix( hash( i + vec2(0.0,0.0) ), \n                    hash( i + vec2(1.0,0.0) ), u.x),\n               mix( hash( i + vec2(0.0,1.0) ), \n                    hash( i + vec2(1.0,1.0) ), u.x), u.y);\n}\n\n// lighting\nfloat diffuse(vec3 n,vec3 l,float p) {\n   return pow(dot(n,l) * 0.4 + 0.6,p);\n}\nfloat specular(vec3 n,vec3 l,vec3 e,float s) {    \n   float nrm = (s + 8.0) / (PI * 8.0);\n   return pow(max(dot(reflect(e,n),l),0.0),s) * nrm;\n}\n\n// sky\nvec3 getSkyColor(vec3 e) {\n   e.y = max(e.y,0.0);\n   return vec3(pow(1.0-e.y,2.0), 1.0-e.y, 0.6+(1.0-e.y)*0.4);\n}\n\n// sea\nfloat sea_octave(vec2 uv, float choppy) {\n   uv += noise(uv);        \n   vec2 wv = 1.0-abs(sin(uv));\n   vec2 swv = abs(cos(uv));    \n   wv = mix(wv,swv,wv);\n   return pow(1.0-pow(wv.x * wv.y,0.65),choppy);\n}\n\nfloat map(vec3 p) {\n   float freq = SEA_FREQ;\n   float amp = SEA_HEIGHT;\n   float choppy = SEA_CHOPPY;\n   vec2 uv = p.xz; uv.x *= 0.75;\n   \n   float d, h = 0.0;    \n   for(int i = 0; i < ITER_GEOMETRY; i++) {        \n     d = sea_octave((uv+SEA_TIME)*freq,choppy);\n     d += sea_octave((uv-SEA_TIME)*freq,choppy);\n       h += d * amp;        \n     uv *= octave_m; freq *= 1.9; amp *= 0.22;\n       choppy = mix(choppy,1.0,0.2);\n   }\n   return p.y - h;\n}\n\nfloat map_detailed(vec3 p) {\n   float freq = SEA_FREQ;\n   float amp = SEA_HEIGHT;\n   float choppy = SEA_CHOPPY;\n   vec2 uv = p.xz; uv.x *= 0.75;\n   \n   float d, h = 0.0;    \n   for(int i = 0; i < ITER_FRAGMENT; i++) {        \n     d = sea_octave((uv+SEA_TIME)*freq,choppy);\n     d += sea_octave((uv-SEA_TIME)*freq,choppy);\n       h += d * amp;        \n     uv *= octave_m; freq *= 1.9; amp *= 0.22;\n       choppy = mix(choppy,1.0,0.2);\n   }\n   return p.y - h;\n}\n\nvec3 getSeaColor(vec3 p, vec3 n, vec3 l, vec3 eye, vec3 dist) {  \n   float fresnel = clamp(1.0 - dot(n,-eye), 0.0, 1.0);\n   fresnel = pow(fresnel,3.0) * 0.65;\n       \n   vec3 reflected = getSkyColor(reflect(eye,n));    \n   vec3 refracted = SEA_BASE + diffuse(n,l,80.0) * SEA_WATER_COLOR * 0.12; \n   \n   vec3 color = mix(refracted,reflected,fresnel);\n   \n   float atten = max(1.0 - dot(dist,dist) * 0.001, 0.0);\n   color += SEA_WATER_COLOR * (p.y - SEA_HEIGHT) * 0.18 * atten;\n   \n   color += vec3(specular(n,l,eye,60.0));\n   \n   return color;\n}\n\n// tracing\nvec3 getNormal(vec3 p, float eps) {\n   vec3 n;\n   n.y = map_detailed(p);    \n   n.x = map_detailed(vec3(p.x+eps,p.y,p.z)) - n.y;\n   n.z = map_detailed(vec3(p.x,p.y,p.z+eps)) - n.y;\n   n.y = eps;\n   return normalize(n);\n}\n\nfloat heightMapTracing(vec3 ori, vec3 dir, out vec3 p) {  \n   float tm = 0.0;\n   float tx = 1000.0;    \n   float hx = map(ori + dir * tx);\n   if(hx > 0.0) return tx;   \n   float hm = map(ori + dir * tm);    \n   float tmid = 0.0;\n   for(int i = 0; i < NUM_STEPS; i++) {\n       tmid = mix(tm,tx, hm/(hm-hx));                   \n       p = ori + dir * tmid;                   \n     float hmid = map(p);\n   if(hmid < 0.0) {\n         tx = tmid;\n           hx = hmid;\n       } else {\n           tm = tmid;\n           hm = hmid;\n       }\n   }\n   return tmid;\n}\n\n// main\n[color] thread(int x, int y) {\n   vec2 uv = vec2(\n     float(x) / float(thread.width),\n     float(y) / float(thread.height)\n   );\n   uv = uv * 2.0 - 1.0;\n   uv.y = -(uv.y + .3);\n   float time = iTime * 0.3 + iMouse.x*0.01;\n       \n   // ray\n   vec3 ang = vec3(sin(time*3.0)*0.1,sin(time)*0.2+0.3,time);    \n   vec3 ori = vec3(0.0,3.5,time*5.0);\n   vec3 dir = normalize(vec3(uv.xy,-2.0)); dir.z += length(uv) * 0.15;\n   dir = normalize(dir) * fromEuler(ang);\n   \n   // tracing\n   vec3 p;\n   heightMapTracing(ori,dir,p);\n   vec3 dist = p - ori;\n   vec3 n = getNormal(p, dot(dist,dist) * EPSILON_NRM);\n   vec3 light = normalize(vec3(0.0,1.0,0.8)); \n            \n   // color\n   vec3 color = mix(\n       getSkyColor(dir),\n       getSeaColor(p,n,light,dir,dist),\n     pow(smoothstep(0.0,-0.05,dir.y),0.3));\n       \n   // post\n thread[0] = vec4(pow(color,vec3(0.75)), 1.0);\n}\n\n\n"; };
  });
  define("index", ["require", "exports", "editor/index", "device/index", "script/index", "code"], function (require, exports, index_2, index_3, index_4, code) {
      "use strict";
      exports.__esModule = true;
      var errors = document.querySelector("#shader-info  > .errors");
      var canvas = document.querySelector("#shader-output  > .canvas");
      var device = new index_3.Device(canvas);
      var uniformEditor = new index_2.Editor(document.querySelector("#uniform-editor > .editor"), "javascript");
      var shaderEditor = new index_2.Editor(document.querySelector("#shader-editor  > .editor"), "glsl");
      var uniforms = function () { return ({}); };
      uniformEditor.change(function (code) {
          uniforms = index_4.resolve(device.getcontext(), code);
      });
      shaderEditor.change(function (code) {
          var error = device.compile(code);
          if (error.length > 0) {
              errors.innerHTML = error[0].split("ERROR:").join("<br /><br />");
          }
          else {
              errors.innerHTML = 'running';
          }
      });
      uniformEditor.set(code.water_demo_javascript());
      shaderEditor.set(code.water_demo_shader());
      var loop = function () {
          window.requestAnimationFrame(function () {
              try {
                  device.present(uniforms());
              }
              catch (error) {
              }
              loop();
          });
      };
      loop();
  });
  
  return collect(); 
})();