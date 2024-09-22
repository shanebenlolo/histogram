import { vec3, mat4 } from "gl-matrix";

export const CreateTransforms = (
  modelMat: mat4,
  translation: vec3 = [0, 0, 0],
  rotation: vec3 = [0, 0, 0],
  scaling: vec3 = [1, 1, 1]
) => {
  const rotateXMat = mat4.create();
  const rotateYMat = mat4.create();
  const rotateZMat = mat4.create();
  const translateMat = mat4.create();
  const scaleMat = mat4.create();

  //perform individual transformations
  mat4.fromTranslation(translateMat, translation);
  mat4.fromXRotation(rotateXMat, rotation[0]);
  mat4.fromYRotation(rotateYMat, rotation[1]);
  mat4.fromZRotation(rotateZMat, rotation[2]);
  mat4.fromScaling(scaleMat, scaling);

  //combine all transformation matrices together to form a final transform matrix: modelMat
  mat4.multiply(modelMat, rotateXMat, scaleMat);
  mat4.multiply(modelMat, rotateYMat, modelMat);
  mat4.multiply(modelMat, rotateZMat, modelMat);
  mat4.multiply(modelMat, translateMat, modelMat);
};

export const CreateViewProjection = (
  time: number,
  respectRatio = 1.0,
  lookDirection: vec3 = [0, 0, 0],
  upDirection: vec3 = [0, 1, 0]
) => {
  // Define the period for the camera movement (in milliseconds)
  const period = 60000; // The camera will complete one oscillation every 30 seconds

  // Calculate the angle for the sine function
  const angle = ((time % period) / period) * 2 * Math.PI; // Converts time to an angle between 0 and 2π

  // Calculate the camera position using the sine function
  const cameraPosition: vec3 = [
    -18 + 18 * Math.sin(angle), // X position oscillates between -50 and 0
    18 - 18 * Math.sin(angle), // Y position oscillates between 0 and 50
    18 * Math.sin(angle), // Z position oscillates between -25 and 25
  ];

  const viewMatrix = mat4.create();
  const projectionMatrix = mat4.create();
  const viewProjectionMatrix = mat4.create();
  mat4.perspective(projectionMatrix, (2 * Math.PI) / 5, respectRatio, 0.1, 100.0);

  mat4.lookAt(viewMatrix, cameraPosition, lookDirection, upDirection);
  mat4.multiply(viewProjectionMatrix, projectionMatrix, viewMatrix);

  const cameraOption = {
    eye: cameraPosition,
    center: lookDirection,
    zoomMax: 100,
    zoomSpeed: 2,
  };

  return {
    viewMatrix,
    projectionMatrix,
    viewProjectionMatrix,
    cameraOption,
  };
};

export const CreateGPUBufferUint = (
  device: GPUDevice,
  data: Uint32Array,
  usageFlag: GPUBufferUsageFlags = GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST
) => {
  const buffer = device.createBuffer({
    size: data.byteLength,
    usage: usageFlag,
    mappedAtCreation: true,
  });
  new Uint32Array(buffer.getMappedRange()).set(data);
  buffer.unmap();
  return buffer;
};

export const CreateGPUBuffer = (
  device: GPUDevice,
  data: Float32Array,
  usageFlag: GPUBufferUsageFlags = GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
) => {
  const buffer = device.createBuffer({
    size: data.byteLength,
    usage: usageFlag,
    mappedAtCreation: true,
  });
  new Float32Array(buffer.getMappedRange()).set(data);
  buffer.unmap();
  return buffer;
};

export const InitGPU = async () => {
  const checkgpu = CheckWebGPU();
  if (checkgpu.includes("Your current browser does not support WebGPU!")) {
    console.log(checkgpu);
    throw "Your current browser does not support WebGPU!";
  }
  const canvas = document.getElementById("canvas-webgpu") as HTMLCanvasElement;
  const adapter = await navigator.gpu?.requestAdapter();
  const device = (await adapter?.requestDevice()) as GPUDevice;
  const context = canvas.getContext("webgpu") as GPUCanvasContext;

  /*const devicePixelRatio = window.devicePixelRatio || 1;
    const size = [
        canvas.clientWidth * devicePixelRatio,
        canvas.clientHeight * devicePixelRatio,
    ];*/
  //const format = context.getPreferredFormat(adapter!);
  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({
    device: device,
    format: format,
    //size: size
    alphaMode: "opaque",
  });
  return { device, canvas, format, context };
};

/*export const InitGPU = async () => {
    const checkgpu = CheckWebGPU();
    if(checkgpu.includes('Your current browser does not support WebGPU!')){
        console.log(checkgpu);
        throw('Your current browser does not support WebGPU!');
    }
    const canvas = document.getElementById('canvas-webgpu') as HTMLCanvasElement;
    const adapter = await navigator.gpu?.requestAdapter();
    const device = await adapter?.requestDevice() as GPUDevice;
    const context = canvas.getContext('gpupresent') as unknown as GPUCanvasContext;
    const swapChainFormat = 'bgra8unorm';
    const swapChain = context.configureSwapChain({
        device: device,
        format: swapChainFormat
    });
    return{device, canvas, swapChainFormat, swapChain };
};*/

export const CheckWebGPU = () => {
  let result = "Great, your current browser supports WebGPU!";
  if (!navigator.gpu) {
    result = `Your current browser does not support WebGPU! Make sure you are on a system 
                    with WebGPU enabled. Currently, WebGPU is supported in  
                    <a href="https://www.google.com/chrome/canary/">Chrome canary</a>
                    with the flag "enable-unsafe-webgpu" enabled. See the 
                    <a href="https://github.com/gpuweb/gpuweb/wiki/Implementation-Status"> 
                    Implementation Status</a> page for more details.   
                    You can also use your regular Chrome to try a pre-release version of WebGPU via
                    <a href="https://developer.chrome.com/origintrials/#/view_trial/118219490218475521">Origin Trial</a>.                
                `;
  }

  const canvas = document.getElementById("canvas-webgpu") as HTMLCanvasElement;
  if (canvas) {
    const div = document.getElementsByClassName("item2")[0] as HTMLDivElement;
    if (div) {
      canvas.width = div.offsetWidth;
      canvas.height = div.offsetHeight;

      function windowResize() {
        canvas.width = div.offsetWidth;
        canvas.height = div.offsetHeight;
      }
      window.addEventListener("resize", windowResize);
    }
  }

  return result;
};

export function transformPositions(time: number, positions: Float32Array) {
  // osciallte between 0.1 and 1.5 just for fun
  const yValue = 0.7 * Math.sin(time / 1000) + 0.8;
  const negYValue = -(0.7 * Math.sin(time / 1000) + 0.8);

  // front
  positions[1] = negYValue;
  positions[4] = negYValue;
  positions[7] = yValue;
  positions[10] = yValue;
  positions[13] = yValue;
  positions[16] = negYValue;

  // right
  positions[19] = negYValue;
  positions[22] = negYValue;
  positions[25] = yValue;
  positions[28] = yValue;
  positions[31] = yValue;
  positions[34] = negYValue;

  // back
  positions[37] = negYValue;
  positions[40] = yValue;
  positions[43] = yValue;
  positions[46] = yValue;
  positions[49] = negYValue;
  positions[52] = negYValue;

  // left
  positions[55] = negYValue;
  positions[58] = yValue;
  positions[61] = yValue;
  positions[64] = yValue;
  positions[67] = negYValue;
  positions[70] = negYValue;

  // top
  positions[73] = yValue;
  positions[76] = yValue;
  positions[79] = yValue;
  positions[82] = yValue;
  positions[85] = yValue;
  positions[88] = yValue;

  // bottom
  positions[91] = negYValue;
  positions[94] = negYValue;
  positions[97] = negYValue;
  positions[100] = negYValue;
  positions[103] = negYValue;
  positions[106] = negYValue;
}
