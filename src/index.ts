/*--------------------------------------------------------------------------

tesseract-compute-shaders

The MIT License (MIT)

Copyright (c) 2017 Haydn Paterson (sinclair) <haydn.developer@gmail.com>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

---------------------------------------------------------------------------*/

import {Editor}        from "./editor/index"
import {Device}        from "./device/index"
import {createContext} from "./gpu/index"
import {resolve}       from "./script/index"
import * as code       from "./code"

const errors         = document.querySelector("#shader-info  > .errors") as HTMLPreElement
const canvas         = document.querySelector("#shader-output  > .canvas") as HTMLCanvasElement
const device         = new Device(canvas as HTMLCanvasElement)
const uniformEditor  = new Editor(document.querySelector("#uniform-editor > .editor") as HTMLElement, "javascript")
const shaderEditor   = new Editor(document.querySelector("#shader-editor  > .editor") as HTMLElement, "glsl")

let uniforms = () => ({})
uniformEditor.change(code => {
  uniforms = resolve(device.getcontext(), code)  
})

shaderEditor.change(code => {
  const error = device.compile(code)
  if(error.length > 0) {
    errors.innerHTML = error[0].split("ERROR:").join("<br /><br />")

  } else {
    errors.innerHTML = 'running'

  }
})

uniformEditor.set(code.water_demo_javascript())
shaderEditor.set (code.water_demo_shader())
const loop = () => {
  window.requestAnimationFrame(() => {
    try {
      device.present(uniforms())
    } catch (error) {
  
    }
    loop()
  })
}
loop()