import { InitGPU, CreateGPUBuffer, CreateTransforms, CreateViewProjection, transformPositions } from "./helper";
import { shader } from "./shader";
import "./site.css";
import { CubeData } from "./vertex_data";
import { mat4 } from "gl-matrix";

const Create3DObject = async () => {
  const gpu = await InitGPU();
  const device = gpu.device;

  const kNumObjects = 512;
  let kNumRows = 512;
  const cubeData = CubeData();

  const instanceHeights = new Float32Array(kNumObjects);
  for (let i = 0; i < kNumObjects; i++) {
    instanceHeights[i] = Math.random() * 20; // Random height for each cube
  }
  const numberOfVertices = cubeData.positions.length / 3;

  const vertexBuffer = CreateGPUBuffer(device, cubeData.positions);
  // const colorBuffer = CreateGPUBuffer(device, cubeData.colors);
  // const instanceHeightBuffer = CreateGPUBuffer(device, instanceHeights);

  // Enable multisampling by setting the sample count to 4 (you can change it based on your requirements)
  const sampleCount = 4;

  const bindGroupLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX,
        buffer: { type: "uniform", minBindingSize: 64 }, // 64 bytes for mat4x4<f32> + 4 bytes for rowCount + 12 bytes padding
      },
      {
        binding: 1,
        visibility: GPUShaderStage.VERTEX,
        buffer: { type: "uniform", minBindingSize: 16 }, // 4 bytes for rowCount + 12 bytes padding
      },
      {
        binding: 2,
        visibility: GPUShaderStage.VERTEX,
        buffer: { type: "uniform", minBindingSize: 16 }, // 4 bytes for rowCount + 12 bytes padding
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
        // {
        //   arrayStride: 12,
        //   attributes: [{ shaderLocation: 1, format: "float32x3", offset: 0 }],
        // },
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
  const mvpBuffer = device.createBuffer({
    size: 64, // 64 bytes for mat4x4<f32>
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  // Create a uniform buffer that combines both the MVP matrix and the time
  const rowCountBuffer = device.createBuffer({
    size: 16, // 4 bytes for rowCount + 12 bytes padding
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  // Create a uniform buffer that combines both the MVP matrix and the time
  const timeBuffer = device.createBuffer({
    size: 16, // 4 bytes for rowCount + 12 bytes padding
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      {
        binding: 0,
        resource: {
          buffer: mvpBuffer,
        },
      },
      {
        binding: 1,
        resource: {
          buffer: rowCountBuffer,
        },
      },
      {
        binding: 2,
        resource: {
          buffer: timeBuffer,
        },
      },
    ],
  });

  CreateTransforms(modelMatrix);
  mat4.multiply(mvpMatrix, vpMatrix, modelMatrix);

  device.queue.writeBuffer(mvpBuffer, 0, mvpMatrix as ArrayBuffer);
  device.queue.writeBuffer(rowCountBuffer, 0, new Float32Array([kNumRows]));

  // const depthTexture = device.createTexture({
  //   size: [gpu.canvas.width, gpu.canvas.height, 1],
  //   format: "depth24plus",
  //   usage: GPUTextureUsage.RENDER_ATTACHMENT,
  // });

  // Create multisampled color texture
  const multisampledColorTexture = device.createTexture({
    size: [gpu.canvas.width, gpu.canvas.height, 1],
    sampleCount: sampleCount, // Use the same sample count
    format: gpu.format as GPUTextureFormat,
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
  });

  const depthTexture = device.createTexture({
    size: [gpu.canvas.width, gpu.canvas.height, 1],
    format: "depth24plus",
    sampleCount: sampleCount, // Use the same sample count for depth texture
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
  });

  function drawNextFrame(time: number) {
    const textureView = gpu.context.getCurrentTexture().createView();

    const renderPassDescription = {
      colorAttachments: [
        {
          view: multisampledColorTexture.createView(), // Use the multisampled texture for rendering
          resolveTarget: textureView, // Resolve the multisampled texture into the canvas texture
          clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 }, // Background color
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

    // kNumRows += 1;
    device.queue.writeBuffer(rowCountBuffer, 0, new Float32Array([kNumRows]));

    device.queue.writeBuffer(timeBuffer, 0, new Float32Array([time]));

    const vp = CreateViewProjection(time, gpu.canvas.width / gpu.canvas.height);
    vpMatrix = vp.viewProjectionMatrix;
    mat4.multiply(mvpMatrix, vpMatrix, modelMatrix);
    device.queue.writeBuffer(mvpBuffer, 0, mvpMatrix as ArrayBuffer);

    const commandEncoder = device.createCommandEncoder();
    const renderPass = commandEncoder.beginRenderPass(renderPassDescription as GPURenderPassDescriptor);

    renderPass.setPipeline(pipeline);
    renderPass.setVertexBuffer(0, vertexBuffer);
    renderPass.setBindGroup(0, bindGroup);
    renderPass.draw(numberOfVertices, kNumObjects * kNumRows);
    renderPass.end();

    device.queue.submit([commandEncoder.finish()]);

    // if (kNumRows > 512) return;

    requestAnimationFrame(drawNextFrame);
  }

  // setInterval(() => {
  //   console.log("total number of objects on screen:");
  //   console.log(kNumObjects * kNumRows);
  // }, 10000);

  requestAnimationFrame(drawNextFrame);
};

Create3DObject();

window.addEventListener("resize", function () {
  Create3DObject();
});
