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

import { Context, Program, Color2D } from "../gpu/index"

export class Device {
  private webgl:     WebGL2RenderingContext
  private context:   Context
  private program:   Program
  private outputs:   Color2D[]
  private ready:    boolean

  constructor(private canvas: HTMLCanvasElement) {
    const options = {alpha: false, depth: false, antialias: false }
    this.webgl    = this.canvas.getContext("webgl2", options) as WebGL2RenderingContext
    this.context  = new Context(this.webgl)
    this.ready   = false
    this.outputs = []
  }

  /**
   * returns this devices gpgpu context.
   * @returns {Context}
   */
  public getcontext(): Context {
    return this.context
  }

  /**
   * returns the width of this device.
   * @returns {number}
   */
  public width():  number { return this.canvas.clientWidth }
  
  /**
   * returns the height of this device.
   * @returns {number}
   */
  public height(): number { return this.canvas.clientHeight }

  /**
   * sets the given shader.
   * @param {string} code the tesseract code.
   * @returns {boolean}
   */
  public compile(code: string): string[] {
    this.reset()
    return this.setup(code)
  }
  /**
   * draws the shader with the given uniforms.
   * @param {string} uniforms javascript object containing uniforms.
   * @returns {boolean}
   */
  public present(uniforms: any): void {
    if(this.ready) {
      this.program.execute(this.outputs, uniforms)
      this.context.render(this.outputs[0])
    }
  }

  /**
   * sets up this device with the given code.
   * @param {string} code the code to set.
   * @returns {void}
   */
  private setup(code: string): string[] {
    try {
      this.canvas.width  = this.width ()
      this.canvas.height = this.height()
      this.program = this.context.createProgram(code)
      for(let i = 0; i < this.program.script.thread.outputs.length; i++) {
        const output = this.context.createColor2D(this.width(), this.height()).push()
        this.outputs.push(output)
      }
      this.ready = true
      return []
    } catch( error ) {
      return [error.toString()]
    }
  }
  /**
   * resets this device, disposing of any buffer.
   * @returns {void}
   */
  private reset(): void {
    if(this.ready) {
      this.outputs.forEach(output => output.dispose())
      this.outputs = []
      this.program.dispose()
    }
    this.ready = false
  }

  /**
   * disposes of this device.
   * @returns {void}
   */
  public dispose(): void {
    this.reset()
    this.context.dispose()
  }

}