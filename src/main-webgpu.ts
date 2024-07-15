import "./style.css";

const width = 1080;
const height = 1080;
const vsUrl = "http://localhost:3000/vertexShader.glsl";
const fsUrl = "http://localhost:3000/fragmentShader.glsl";
const imageUrl = "http://localhost:3000/black-circle.jpg";

const kNumObjects = 100;

enum WGSL_MEM_SIZE {
  VEC_4_F = 4 * 4, // 4 32bit floats (4bytes each)
  VEC_2_F = 2 * 4, // 2 32bit floats (4bytes each)
}

interface TriangleInfo {
  dynamicStorageBuffer: GPUBuffer;
  dynamicStorageValues: Float32Array;
  bindGroup: GPUBindGroup;
  numVertices: number;
}

// Set up the HTML structure
document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <div>
    <canvas id="webglCanvas" width="${width}" height="${height}" style="border:1px solid #000000;"></canvas>
  </div>
`;

main();

async function main() {
  const canvas = document.getElementById("webglCanvas") as HTMLCanvasElement;
  const adapter = await navigator.gpu?.requestAdapter();
  const device = await adapter?.requestDevice()!;
  if (!device) {
    new Error("need a browser that supports WebGPU");
    return;
  }
  const context = canvas.getContext("webgpu")!;
  const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
  context.configure({ device, format: presentationFormat });

  const module = initShaderModule(device);
  const pipeline = initPipeline(device, module, presentationFormat);
  const trianglesData = initBuffers(device, pipeline);

  function nextFrame(_time: number) {
    update();
    render(device, context, pipeline, trianglesData);
    requestAnimationFrame(nextFrame);
  }
  requestAnimationFrame(nextFrame);
}

function initShaderModule(device: GPUDevice) {
  return device.createShaderModule({
    label: "hardcoded triangle",
    code: `
      struct StaticStorage {
        color: vec4f,
        translation: vec2f,
      };

      struct DynamicStorage {
        scale: vec2f,
      };

      struct Vertex {
        position: vec2f,
      };

      struct VsOutput {
        @builtin(position) position: vec4f,
        @location(0) color: vec4f,
      }

      @group(0) @binding(0) var<storage, read> staticStorageList: array<StaticStorage>;
      @group(0) @binding(1) var<storage, read> dynamicStorageList: array<DynamicStorage>;
      @group(0) @binding(2) var<storage, read> pos: array<Vertex>;

      @vertex fn vs(
        @builtin(vertex_index) vertexIndex : u32,
        @builtin(instance_index) instanceIndex : u32,
      ) -> VsOutput {
        let staticStorage = staticStorageList[instanceIndex];
        let dynamicStorage = dynamicStorageList[instanceIndex];

        var vsOut: VsOutput;
        vsOut.position = vec4f(
           pos[vertexIndex].position * dynamicStorage.scale + staticStorage.translation, 0.0, 1.0);
        vsOut.color = staticStorage.color;

        return vsOut;
      }

      @fragment fn fs(vsOut: VsOutput) -> @location(0) vec4f {
        return vsOut.color;
      }
    `,
  });
}

function initPipeline(device: GPUDevice, module: GPUShaderModule, presentationFormat: GPUTextureFormat) {
  return device.createRenderPipeline({
    label: "our hardcoded red triangle pipeline",
    layout: "auto",
    vertex: {
      entryPoint: "vs",
      module,
    },
    fragment: {
      entryPoint: "fs",
      module,
      targets: [{ format: presentationFormat }],
    },
  });
}

function initRenderPassDescriptor(context: GPUCanvasContext): GPURenderPassDescriptor {
  return {
    label: "our basic canvas renderPass",
    colorAttachments: [
      {
        clearValue: [0.3, 0.3, 0.3, 1],
        loadOp: "clear",
        storeOp: "store",
        view: context.getCurrentTexture().createView(),
      },
    ],
  };
}

function render(
  device: GPUDevice,
  context: GPUCanvasContext,
  pipeline: GPURenderPipeline,
  { dynamicStorageBuffer, dynamicStorageValues, bindGroup, numVertices }: TriangleInfo
) {
  const renderPassDescriptor = initRenderPassDescriptor(context);
  const encoder = device.createCommandEncoder({ label: "our encoder" });
  const pass = encoder.beginRenderPass(renderPassDescriptor);

  pass.setPipeline(pipeline);

  // set the scales for each object (excllent candidate for webworker + sharedtypedarray)

  for (let i = 0; i < kNumObjects; i++) {
    const dynamicUnitSize = (dynamicStorageValues.length * 4) / kNumObjects; // reverse math as init buffer, equals WGSL_MEM_SIZE.VEC_2_F
    const kScaleOffset = 0; //  vec2f
    const scale = rand(0.2, 0.21);
    const offset = i * (dynamicUnitSize / 4);
    dynamicStorageValues.set([scale / (width / height), scale], offset + kScaleOffset); // set the scale
  }

  // pass all data in on write
  device.queue.writeBuffer(dynamicStorageBuffer, 0, dynamicStorageValues);

  pass.setBindGroup(0, bindGroup);
  pass.draw(numVertices, kNumObjects); // call our vertex shader 3 times
  pass.end();

  const commandBuffer = encoder.finish();
  device.queue.submit([commandBuffer]);
}

function update() {}

function initBuffers(device: GPUDevice, pipeline: GPURenderPipeline) {
  // static attributes storage setup
  // memory layout offsets for static bindgroup
  const kColorOffset = 0; // color: vec4f
  const kTranslationOffset = 4; // translation: vec2f

  // define memory size of each attribute
  const staticUnitSize =
    WGSL_MEM_SIZE.VEC_4_F + // color: vec4f
    WGSL_MEM_SIZE.VEC_2_F + // translation: vec2f
    2 * 4; // padding to conform to memory layout requirements: https://webgpufundamentals.org/webgpu/lessons/webgpu-memory-layout.html

  const staticStorageBufferSize = staticUnitSize * kNumObjects;
  const staticStorageValues = new Float32Array(staticStorageBufferSize / 4); // divide by 4 because Float32Array already assume every index holds 4 bytes of data

  const staticStorageBuffer = device.createBuffer({
    label: `static storage for objects`,
    size: staticStorageBufferSize, // size of total memory layout
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });

  for (let i = 0; i < kNumObjects; i++) {
    const objectOffset = i * (staticUnitSize / 4);
    staticStorageValues.set([rand(0, 1), rand(0, 1), rand(0, 1), 1], objectOffset + kColorOffset); // set the color
    staticStorageValues.set([rand(-0.9, 0.9), rand(-0.9, 0.9)], objectOffset + kTranslationOffset); // set the offset
    // copy values to the GPU
    device.queue.writeBuffer(staticStorageBuffer, 0, staticStorageValues);
  }

  // dynamic attributes storage setup (buffer values set in render metho)
  const dynamicUnitSize = WGSL_MEM_SIZE.VEC_2_F; // scale: vec2f
  const dynamicStorageBufferSize = dynamicUnitSize * kNumObjects;
  const dynamicStorageValues = new Float32Array(dynamicStorageBufferSize / 4);

  const dynamicStorageBuffer = device.createBuffer({
    label: `dynamic storage for objects`,
    size: dynamicStorageBufferSize,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });

  // vertex data storage setup
  const { vertexData, numVertices } = createTriangleVertices();
  const vertexStorageBuffer = device.createBuffer({
    label: "storage buffer vertices",
    size: vertexData.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(vertexStorageBuffer, 0, vertexData);

  const bindGroup = device.createBindGroup({
    label: `bind group for objects`,
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: staticStorageBuffer } },
      { binding: 1, resource: { buffer: dynamicStorageBuffer } },
      { binding: 2, resource: { buffer: vertexStorageBuffer } },
    ],
  });

  return { dynamicStorageBuffer, dynamicStorageValues, bindGroup, numVertices };
}

function createTriangleVertices() {
  // 3 verts per tri, 2 values (xy) each.
  const numVertices = 3 * 2;
  const vertexData = new Float32Array(numVertices);

  let offset = 0;
  const addVertex = (x: number, y: number) => {
    vertexData[offset++] = x;
    vertexData[offset++] = y;
  };

  // first triangle
  addVertex(0.5, 0.0);
  addVertex(0.0, 0.5);
  addVertex(-0.5, 0.0);

  return {
    vertexData,
    numVertices,
  };
}

// A random number between [min and max)
const rand = (min: number, max: number) => {
  return min + Math.random() * (max - min);
};
