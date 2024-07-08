import "./style.css";
import { mat4 } from "gl-matrix";

interface WebGLProgramInfo {
  program: WebGLProgram;
  attribLocations: {
    vertexPosition: number;
    textureCoord: number;
  };
  uniformLocations: {
    projectionMatrix: WebGLUniformLocation;
    modelViewMatrix: WebGLUniformLocation;
    uSampler: WebGLUniformLocation;
    uResolution: WebGLUniformLocation;
    uTime: WebGLUniformLocation;
  };
}

const width = 1080;
const height = 1080;

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
    alert(
      "Unable to initialize WebGL. Your browser or machine may not support it."
    );
    return;
  }

  const vsUrl = "http://localhost:3000/vertexShader.glsl";
  const fsUrl = "http://localhost:3000/fragmentShader.glsl";
  const textureUrl = "http://localhost:3000/black-circle.jpg";
  const shaderProgram = await initShaderProgram(gl, vsUrl, fsUrl)!;
  const buffers = initBuffers(gl);
  const texture = await initTexture(gl, textureUrl);

  const programInfo: WebGLProgramInfo = {
    program: shaderProgram!,
    attribLocations: {
      vertexPosition: gl.getAttribLocation(shaderProgram!, "aVertexPosition"),
      textureCoord: gl.getAttribLocation(shaderProgram!, "aTextureCoord"),
    },
    uniformLocations: {
      projectionMatrix: gl.getUniformLocation(
        shaderProgram!,
        "uProjectionMatrix"
      )!,
      modelViewMatrix: gl.getUniformLocation(
        shaderProgram!,
        "uModelViewMatrix"
      )!,
      uResolution: gl.getUniformLocation(shaderProgram!, "uResolution")!,
      uSampler: gl.getUniformLocation(shaderProgram!, "uSampler")!,
      uTime: gl.getUniformLocation(shaderProgram!, "uTime")!,
    },
  };

  function render(time: number) {
    // prepare scene (update)

    drawScene(gl, programInfo, buffers, texture, time);
    requestAnimationFrame(render); // Continuously re-render the scene
  }

  requestAnimationFrame(render); // Start the rendering loop
}

async function initShaderProgram(
  gl: WebGL2RenderingContext,
  vsUrl: string,
  fsUrl: string
) {
  async function loadShaderSource(url: string) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `Failed to load shader from ${url}: ${response.statusText}`
      );
    }
    return response.text();
  }

  // Load shader sources from URLs
  const vsSource = await loadShaderSource(vsUrl);
  const fsSource = await loadShaderSource(fsUrl);

  // Utility function to create a shader
  function loadShader(
    gl: WebGL2RenderingContext,
    type: number,
    source: string
  ) {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      alert(
        "An error occurred compiling the shaders: " +
          gl.getShaderInfoLog(shader)
      );
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
    alert(
      "Unable to initialize the shader program: " +
        gl.getProgramInfoLog(shaderProgram)
    );
    return null;
  }

  return shaderProgram;
}

function initBuffers(gl: WebGL2RenderingContext) {
  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  const positions = [1.0, 1.0, -1.0, 1.0, 1.0, -1.0, -1.0, -1.0];
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

  const textureCoordBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, textureCoordBuffer);
  const textureCoordinates = [1.0, 0.0, 0.0, 0.0, 1.0, 1.0, 0.0, 1.0];
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array(textureCoordinates),
    gl.STATIC_DRAW
  );

  return {
    position: positionBuffer,
    textureCoord: textureCoordBuffer,
  };
}

async function initTexture(gl: WebGL2RenderingContext, url: string) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  const image = new Image();
  image.crossOrigin = "anonymous"; // This is important for CORS
  const loadPromise = new Promise((resolve, reject) => {
    image.onload = () => {
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        image
      );
      gl.generateMipmap(gl.TEXTURE_2D);
      resolve(texture);
    };
    image.onerror = reject;
  });
  image.src = url;
  await loadPromise;
  return texture;
}

function drawScene(
  gl: WebGL2RenderingContext,
  programInfo: WebGLProgramInfo,
  buffers: {
    position: WebGLBuffer | null;
    textureCoord: WebGLBuffer | null;
  },
  texture: WebGLTexture | null,
  time: number
) {
  gl.clearColor(0.0, 0.0, 0.0, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.useProgram(programInfo.program);

  gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
  gl.vertexAttribPointer(
    programInfo.attribLocations.vertexPosition,
    2,
    gl.FLOAT,
    false,
    0,
    0
  );
  gl.enableVertexAttribArray(programInfo.attribLocations.vertexPosition);

  gl.bindBuffer(gl.ARRAY_BUFFER, buffers.textureCoord);
  gl.vertexAttribPointer(
    programInfo.attribLocations.textureCoord,
    2,
    gl.FLOAT,
    false,
    0,
    0
  );
  gl.enableVertexAttribArray(programInfo.attribLocations.textureCoord);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.uniform1i(programInfo.uniformLocations.uSampler, 0); //sampler2d

  gl.uniform1f(programInfo.uniformLocations.uTime, time / 1000);
  gl.uniform2f(programInfo.uniformLocations.uResolution, width, height); // vec2

  const fieldOfView = (45 * Math.PI) / 180;
  const aspect = gl.canvas.width / gl.canvas.height;
  const zNear = 0.1;
  const zFar = 100.0;
  const projectionMatrix = mat4.create();
  mat4.perspective(projectionMatrix, fieldOfView, aspect, zNear, zFar);

  const modelViewMatrix = mat4.create();
  mat4.translate(modelViewMatrix, modelViewMatrix, [-0.0, 0.0, -3.0]);

  gl.uniformMatrix4fv(
    programInfo.uniformLocations.projectionMatrix,
    false,
    projectionMatrix
  );
  gl.uniformMatrix4fv(
    programInfo.uniformLocations.modelViewMatrix,
    false,
    modelViewMatrix
  );

  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}
