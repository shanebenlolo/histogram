import { InitGPU, CreateGPUBuffer, CreateTransforms, CreateViewProjection, transformPositions } from "./helper";
import { axisShader } from "./shaders/axis";
import { cubeShader } from "./shaders/cube";
import "./site.css";
import { CubeData } from "./vertex_data";
import { mat4 } from "gl-matrix";

const Create3DObject = async () => {
  const gpu = await InitGPU();
  const device = gpu.device;

  const kNumObjects = 256;
  let kNumRows = 256;
  const cubeData = CubeData();
  const numberOfVertices = cubeData.positions.length / 3;
  const vertexBuffer = CreateGPUBuffer(device, cubeData.positions);
  const multisample: boolean = true;
  const sampleCount = multisample ? 4 : 1;

  const axisBindGroupLayout = device.createBindGroupLayout({
    label: "axis bind group layout",
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX,
        buffer: { type: "uniform", minBindingSize: 64 }, // 64 bytes for mat4x4<f32> + 4 bytes for rowCount + 12 bytes padding
      },
    ],
  });
  const axisPipeline = device.createRenderPipeline({
    label: "axis pipeline",
    layout: device.createPipelineLayout({ bindGroupLayouts: [axisBindGroupLayout] }),
    vertex: {
      module: device.createShaderModule({
        code: axisShader,
      }),
      entryPoint: "vs_main",
    },
    fragment: {
      module: device.createShaderModule({
        code: axisShader,
      }),
      entryPoint: "fs_main",
      targets: [
        {
          format: gpu.format as GPUTextureFormat,
          // @ts-ignore
          sampleCount: sampleCount,
        },
      ],
    },
    primitive: {
      topology: "line-list" as GPUPrimitiveTopology,
      // stripIndexFormat: "uint32" as GPUIndexFormat,
    },
    depthStencil: {
      format: "depth24plus", // Ensure depth buffer is used in axis pipeline
      depthWriteEnabled: true,
      depthCompare: "less",
    },
    multisample: {
      count: sampleCount,
    },
  });

  const cubeBindGroupLayout = device.createBindGroupLayout({
    label: "cube bindgroup layout",
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
    ],
  });
  const cubePipeline = device.createRenderPipeline({
    label: "cube pipeline",
    layout: device.createPipelineLayout({
      bindGroupLayouts: [cubeBindGroupLayout],
    }),
    vertex: {
      module: device.createShaderModule({
        code: cubeShader,
      }),
      entryPoint: "vs_main",
      buffers: [
        // ... position?
        {
          arrayStride: 12,
          attributes: [{ shaderLocation: 0, format: "float32x3", offset: 0 }],
        },
      ],
    },
    fragment: {
      module: device.createShaderModule({
        code: cubeShader,
      }),
      entryPoint: "fs_main",
      targets: [
        {
          format: gpu.format as GPUTextureFormat,
          // @ts-ignore
          sampleCount: sampleCount,
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
      count: sampleCount,
    },
  });

  // Create uniform data
  const modelMatrix = mat4.create();
  const mvpMatrix = mat4.create();
  let vpMatrix = mat4.create();
  const vp = CreateViewProjection(gpu.canvas.width / gpu.canvas.height);
  vpMatrix = vp.viewProjectionMatrix;

  const mvpBuffer = device.createBuffer({
    size: 64, // 64 bytes for mat4x4<f32>
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const axisBindGroup = device.createBindGroup({
    layout: axisPipeline.getBindGroupLayout(0),
    entries: [
      {
        binding: 0,
        resource: {
          buffer: mvpBuffer,
        },
      },
    ],
  });

  const cubeTimeBuffer = device.createBuffer({
    size: 16, // 4 bytes for rowCount + 12 bytes padding
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const cubeBindGroup = device.createBindGroup({
    layout: cubePipeline.getBindGroupLayout(0),
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
          buffer: cubeTimeBuffer,
        },
      },
    ],
  });

  CreateTransforms(modelMatrix);
  mat4.multiply(mvpMatrix, vpMatrix, modelMatrix);

  device.queue.writeBuffer(mvpBuffer, 0, mvpMatrix as ArrayBuffer);

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
          view: multisample ? multisampledColorTexture.createView() : textureView, // Use the multisampled texture for rendering
          resolveTarget: multisample ? textureView : undefined, // Resolve the multisampled texture into the canvas texture
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

    // Update buffers

    // time
    device.queue.writeBuffer(cubeTimeBuffer, 0, new Float32Array([time]));

    // Camera
    const vp = CreateViewProjection(time, gpu.canvas.width / gpu.canvas.height);
    vpMatrix = vp.viewProjectionMatrix;
    mat4.multiply(mvpMatrix, vpMatrix, modelMatrix);
    device.queue.writeBuffer(mvpBuffer, 0, mvpMatrix as ArrayBuffer);

    const commandEncoder = device.createCommandEncoder();
    const renderPass = commandEncoder.beginRenderPass(renderPassDescription as GPURenderPassDescriptor);

    // Drawing the cubes
    renderPass.setPipeline(cubePipeline);
    renderPass.setVertexBuffer(0, vertexBuffer);
    renderPass.setBindGroup(0, cubeBindGroup);
    renderPass.draw(numberOfVertices, kNumObjects * kNumRows);

    // Drawing the axis lines (same render pass)
    renderPass.setBindGroup(0, axisBindGroup);
    renderPass.setPipeline(axisPipeline);
    renderPass.draw(6);

    // End the render pass once after both draw calls
    renderPass.end();

    device.queue.submit([commandEncoder.finish()]);

    // Request the next frame
    requestAnimationFrame(drawNextFrame);
  }

  requestAnimationFrame(drawNextFrame);
};

Create3DObject();

window.addEventListener("resize", function () {
  Create3DObject();
});
