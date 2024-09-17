import { InitGPU, CreateGPUBuffer, CreateTransforms, CreateViewProjection, transformPositions } from "./helper";
import { shader } from "./shader";
import "./site.css";
import { CubeData } from "./vertex_data";
import { mat4 } from "gl-matrix";

const Create3DObject = async () => {
  const gpu = await InitGPU();
  const device = gpu.device;

  const kNumObjects = 256;
  let kNumRows = 1;
  const cubeData = CubeData();

  const instanceHeights = new Float32Array(kNumObjects);
  for (let i = 0; i < kNumObjects; i++) {
    instanceHeights[i] = Math.random() * 20; // Random height for each cube
  }
  const numberOfVertices = cubeData.positions.length / 3;

  const vertexBuffer = CreateGPUBuffer(device, cubeData.positions);
  const colorBuffer = CreateGPUBuffer(device, cubeData.colors);
  // const instanceHeightBuffer = CreateGPUBuffer(device, instanceHeights);

  // Enable multisampling by setting the sample count to 4 (you can change it based on your requirements)
  const sampleCount = 4;

  const bindGroupLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX,
        buffer: { type: "uniform", minBindingSize: 80 }, // 64 bytes for mat4x4<f32> + 4 bytes for rowCount + 12 bytes padding
      },
    ],
  });

  // Create the render pipeline with multisampling enabled
  const pipeline = device.createRenderPipeline({
    layout: device.createPipelineLayout({
      bindGroupLayouts: [bindGroupLayout],
    }),
    vertex: {
      module: device.createShaderModule({
        code: shader,
      }),
      entryPoint: "vs_main",
      buffers: [
        {
          arrayStride: 12,
          attributes: [{ shaderLocation: 0, format: "float32x3", offset: 0 }],
        },
        {
          arrayStride: 12,
          attributes: [{ shaderLocation: 1, format: "float32x3", offset: 0 }],
        },
        // {
        //   arrayStride: 4,
        //   stepMode: "instance",
        //   attributes: [{ shaderLocation: 2, format: "float32", offset: 0 }],
        // },
      ],
    },
    fragment: {
      module: device.createShaderModule({
        code: shader,
      }),
      entryPoint: "fs_main",
      targets: [
        {
          format: gpu.format as GPUTextureFormat,
          // @ts-ignore
          sampleCount: sampleCount, // Set sample count for multisampling
        },
      ],
    },
    primitive: {
      topology: "triangle-list",
      cullMode: "back",
    },
    depthStencil: {
      format: "depth24plus",
      depthWriteEnabled: true,
      depthCompare: "less",
    },
    multisample: {
      count: sampleCount, // Enable multisampling with a sample count
    },
  });

  // Create uniform data
  const modelMatrix = mat4.create();
  const mvpMatrix = mat4.create();
  let vpMatrix = mat4.create();
  const vp = CreateViewProjection(gpu.canvas.width / gpu.canvas.height);
  vpMatrix = vp.viewProjectionMatrix;

  // Create a uniform buffer that combines both the MVP matrix and the time
  const uniformsBuffer = device.createBuffer({
    size: 80, // 64 bytes for mat4x4<f32> + 4 bytes for rowCount + 12 bytes padding
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      {
        binding: 0,
        resource: {
          buffer: uniformsBuffer,
          offset: 0,
          size: 80,
        },
      },
    ],
  });

  CreateTransforms(modelMatrix);
  mat4.multiply(mvpMatrix, vpMatrix, modelMatrix);

  const uniforms = new Float32Array(20); // 16 for matrix, 1 for rowCount, 3 padding
  uniforms.set(mvpMatrix, 0); // Set the mvpMatrix
  uniforms[16] = kNumRows; // Set the rowCount
  device.queue.writeBuffer(uniformsBuffer, 0, uniforms.buffer, 0, uniforms.byteLength);

  // Create multisampled color texture
  const multisampledColorTexture = device.createTexture({
    size: [gpu.canvas.width, gpu.canvas.height, 1],
    sampleCount: sampleCount, // Use the same sample count
    format: gpu.format as GPUTextureFormat,
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
  });

  function drawNextFrame() {
    const textureView = gpu.context.getCurrentTexture().createView();
    const depthTexture = device.createTexture({
      size: [gpu.canvas.width, gpu.canvas.height, 1],
      format: "depth24plus",
      sampleCount: sampleCount, // Use the same sample count for depth texture
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });

    const renderPassDescription = {
      colorAttachments: [
        {
          view: multisampledColorTexture.createView(), // Use the multisampled texture for rendering
          resolveTarget: textureView, // Resolve the multisampled texture into the canvas texture
          clearValue: { r: 0.2, g: 0.247, b: 0.314, a: 1.0 }, // Background color
          loadOp: "clear",
          storeOp: "store",
        },
      ],
      depthStencilAttachment: {
        view: depthTexture.createView(),
        depthLoadOp: "clear",
        depthClearValue: 1.0,
        depthStoreOp: "store",
      },
    };

    const commandEncoder = device.createCommandEncoder();
    const renderPass = commandEncoder.beginRenderPass(renderPassDescription as GPURenderPassDescriptor);
    renderPass.setPipeline(pipeline);
    renderPass.setVertexBuffer(0, vertexBuffer);
    renderPass.setVertexBuffer(1, colorBuffer);
    // renderPass.setVertexBuffer(2, instanceHeightBuffer);
    renderPass.setBindGroup(0, bindGroup);
    renderPass.draw(numberOfVertices, kNumObjects * kNumRows);
    renderPass.end();

    device.queue.submit([commandEncoder.finish()]);

    requestAnimationFrame(drawNextFrame);
  }

  setInterval(() => {
    uniforms[16] += 1; // Set the rowCount
    kNumRows += 1;
    device.queue.writeBuffer(uniformsBuffer, 0, uniforms.buffer, 0, uniforms.byteLength);
  }, 100);
  drawNextFrame();
};

Create3DObject();

window.addEventListener("resize", function () {
  Create3DObject();
});
