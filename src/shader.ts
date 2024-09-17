export const shader = `
struct Uniforms {
    mvpMatrix: mat4x4<f32>,
    rowCount: f32 // Floating-point value for consistency with JavaScript
};

@group(0) @binding(0) var<uniform> uniforms : Uniforms;

struct VertexInput {
    @location(0) position: vec4<f32>, // Cube's vertex position
    @location(1) color: vec4<f32>,    // Cube's vertex color
};

// Hash function to generate pseudo-random numbers based on instanceIndex
fn rand(seed: f32) -> f32 {
    let t = fract(sin(seed) * 43758.5453);
    return t;
}

struct Output {
    @builtin(position) Position : vec4<f32>,
    @location(0) vColor : vec4<f32>,
};

@vertex
fn vs_main(
    @builtin(instance_index) instanceIndex: u32,
    vertexInput: VertexInput
) -> Output {
    var output: Output;
    var transformedPosition = vertexInput.position;

    // Define the fixed grid width (256 columns) and cube size (0.05)
    let gridWidth: f32 = 256.0;
    let cubeSize: f32 = 0.05; // Size of each cube

    // Calculate the column (x position) and row (z position) for the grid
    let column = f32(instanceIndex % u32(gridWidth));  // X position (column) within the row
    let row = f32(instanceIndex / u32(gridWidth));     // Z position (row)

    // Adjust the x and z position to center the grid
    transformedPosition.x += (column - gridWidth / 2.0) * cubeSize; // Center cubes horizontally
    transformedPosition.z += (row - uniforms.rowCount / 2.0) * cubeSize; // Center cubes vertically

    // Generate a pseudo-random value for the height using instanceIndex as seed
    let randomHeight = rand(f32(instanceIndex)) *10.0; // Random value between 0 and 1
    let baseY = 0.0; // Set the baseline Y position to 0 for all cubes

    // Scale the Y position to simulate varying cube heights like a histogram
    transformedPosition.y = baseY + vertexInput.position.y * randomHeight; 

    // Apply the model-view-projection matrix to position the vertex in the scene
    output.Position = uniforms.mvpMatrix * transformedPosition;
    
    // Pass the color to the fragment shader
        output.vColor = vec4(f32(row) / uniforms.rowCount, 0.0, 1.0, 1.0); // Visualize rows in color


    return output;
}

@fragment
fn fs_main(@location(0) vColor: vec4<f32>) -> @location(0) vec4<f32> {
    return vColor;
}


`;
