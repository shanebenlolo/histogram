import "./style.css";
import { mat4 } from "gl-matrix";

interface UniformLocations {
  projectionMatrix: WebGLUniformLocation;
  modelViewMatrix: WebGLUniformLocation;
  uSampler: WebGLUniformLocation;
  uResolution: WebGLUniformLocation;
  uTime: WebGLUniformLocation;
}

interface BufferData {
  buffer: WebGLBuffer;
  attributeLocation: number;
  data: Float32Array;
}

const width = 1080;
const height = 1080;

// Define several convolution kernels
var kernels = {
  normal: [0, 0, 0, 0, 1, 0, 0, 0, 0],
  gaussianBlur: [0.045, 0.122, 0.045, 0.122, 0.332, 0.122, 0.045, 0.122, 0.045],
  unsharpen: [-1, -1, -1, -1, 9, -1, -1, -1, -1],
  emboss: [-2, -1, 0, -1, 1, 1, 0, 1, 2],
};

// List of effects to apply.
var effectsToApply = ["gaussianBlur", "emboss", "gaussianBlur", "unsharpen"];

// Set up the HTML structure
document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <div>
    <canvas id="webglCanvas" width="${width}" height="${height}" style="border:1px solid #000000;"></canvas>
  </div>
`;

main();

async function main() {
  const canvas = document.getElementById("webglCanvas") as HTMLCanvasElement;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const gl = canvas.getContext("webgl2")!;

  if (!gl) {
    alert("Unable to initialize WebGL. Your browser or machine may not support it.");
    return;
  }

  const vsUrl = "http://localhost:3000/vertexShader.glsl";
  const fsUrl = "http://localhost:3000/fragmentShader.glsl";
  const textureUrl = "http://localhost:3000/black-circle.jpg";
  const shaderProgram = await initProgram(gl, vsUrl, fsUrl)!;
  const texture = await initTexture(gl, textureUrl);
  const vao = initVao(gl, shaderProgram!);

  const uniformLocations: UniformLocations = {
    projectionMatrix: gl.getUniformLocation(shaderProgram!, "uProjectionMatrix")!,
    modelViewMatrix: gl.getUniformLocation(shaderProgram!, "uModelViewMatrix")!,
    uResolution: gl.getUniformLocation(shaderProgram!, "uResolution")!,
    uSampler: gl.getUniformLocation(shaderProgram!, "uSampler")!,
    uTime: gl.getUniformLocation(shaderProgram!, "uTime")!,
  };

  function render(time: number) {
    // update stuff before draw

    drawScene(gl, shaderProgram!, uniformLocations, vao, texture, time);
    requestAnimationFrame(render); // Continuously re-render the scene
  }

  requestAnimationFrame(render); // Start the rendering loop
}

async function initProgram(gl: WebGL2RenderingContext, vsUrl: string, fsUrl: string) {
  async function loadShaderSource(url: string) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load shader from ${url}: ${response.statusText}`);
    }
    return response.text();
  }

  // Load shader sources from URLs
  const vsSource = await loadShaderSource(vsUrl);
  const fsSource = await loadShaderSource(fsUrl);

  // Utility function to create a shader
  function loadShader(gl: WebGL2RenderingContext, type: number, source: string) {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      alert("An error occurred compiling the shaders: " + gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  // Create shaders
  const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource)!;
  const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource)!;

  // Create shader program
  const shaderProgram = gl.createProgram()!;
  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  gl.linkProgram(shaderProgram);

  // Check for linking errors
  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    alert("Unable to initialize the shader program: " + gl.getProgramInfoLog(shaderProgram));
    return null;
  }

  return shaderProgram;
}

function initBuffer(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  attributeName: string,
  bufferValues: number[]
): BufferData {
  // setup position
  const buffer = gl.createBuffer()!;
  const attributeLocation = gl.getAttribLocation(program, attributeName);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  const data = new Float32Array(bufferValues);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  return { buffer, attributeLocation, data };
}

function initVao(gl: WebGL2RenderingContext, program: WebGLProgram) {
  const position = [1.0, 1.0, -1.0, 1.0, 1.0, -1.0, -1.0, -1.0];
  const positionBufferData = initBuffer(gl, program, "aVertexPosition", position);

  const textureCoords = [1.0, 0.0, 0.0, 0.0, 1.0, 1.0, 0.0, 1.0];
  const textureBufferData = initBuffer(gl, program, "aTextureCoord", textureCoords);

  // create a collection of attribute state
  var vao = gl.createVertexArray();
  gl.bindVertexArray(vao);

  // Set attribute state in VAO
  gl.enableVertexAttribArray(positionBufferData.attributeLocation);
  var size = 2; // 2 components per iteration
  var type = gl.FLOAT; // the data is 32bit floats
  var normalize = false; // don't normalize the data
  var stride = 0; // 0 = move forward size * sizeof(type) each iteration to get the next position
  var offset = 0; // start at the beginning of the buffer
  gl.vertexAttribPointer(positionBufferData.attributeLocation, size, type, normalize, stride, offset);

  gl.enableVertexAttribArray(textureBufferData.attributeLocation);
  var size = 2; // 2 components per iteration
  var type = gl.FLOAT; // the data is 32bit floats
  var normalize = false; // don't normalize the data
  var stride = 0; // 0 = move forward size * sizeof(type) each iteration to get the next position
  var offset = 0; // start at the beginning of the buffer
  gl.vertexAttribPointer(textureBufferData.attributeLocation, size, type, normalize, stride, offset);

  return vao!;
}

async function initTexture(gl: WebGL2RenderingContext, url: string) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);

  // Set up texture so we can render any size image and so we are
  // working with pixels
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  const image = new Image();
  image.crossOrigin = "anonymous"; // This is important for CORS
  const loadPromise = new Promise((resolve, reject) => {
    image.onload = () => {
      // Upload the image into the texture.
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      gl.generateMipmap(gl.TEXTURE_2D);
      resolve(texture);
    };
    image.onerror = reject;
  });
  image.src = url;
  await loadPromise;
  return texture;
}

async function initTextures(gl: WebGL2RenderingContext) {
  const urls = ["http://localhost:3000/black-circle.jpg", "http://localhost:3000/images.png"];
  const textures = [];
  const framebuffers = [];

  for (let i = 0; i < 2; i++) {
    const texture = await initTexture(gl, urls[i]);
    textures.push(texture);

    //Create Framebuffer
    const frambebuffer = gl.createFramebuffer();
    framebuffers.push(frambebuffer);
    gl.bindFramebuffer(gl.FRAMEBUFFER, frambebuffer);

    // attach texture to framebuffer
    let attachmentPoint = gl.COLOR_ATTACHMENT0;
    gl.framebufferTexture2D(gl.FRAMEBUFFER, attachmentPoint, gl.TEXTURE_2D, texture, 0);
  }
}

function drawScene(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  uniformLocations: UniformLocations,
  vao: WebGLVertexArrayObject,
  texture: WebGLTexture | null,
  time: number
) {
  gl.clearColor(0.0, 0.0, 0.0, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.useProgram(program);

  gl.bindVertexArray(vao);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.uniform1i(uniformLocations.uSampler, 0); //sampler2d

  gl.uniform1f(uniformLocations.uTime, time / 1000);
  gl.uniform2f(uniformLocations.uResolution, width, height); // vec2

  const fieldOfView = (45 * Math.PI) / 180;
  const aspect = width / height;
  const zNear = 0.1;
  const zFar = 100.0;
  const projectionMatrix = mat4.create();
  mat4.perspective(projectionMatrix, fieldOfView, aspect, zNear, zFar);

  const modelViewMatrix = mat4.create();
  mat4.translate(modelViewMatrix, modelViewMatrix, [-0.0, 0.0, -3.0]);

  gl.uniformMatrix4fv(uniformLocations.projectionMatrix, false, projectionMatrix);
  gl.uniformMatrix4fv(uniformLocations.modelViewMatrix, false, modelViewMatrix);

  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}
