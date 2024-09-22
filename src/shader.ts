export const shader = `
@group(0) @binding(0) var<uniform> mvpMatrix : mat4x4<f32>;
@group(0) @binding(1) var<uniform> rowCount : f32;
@group(0) @binding(2) var<uniform> time : f32;

struct VertexInput {
    @location(0) position: vec4<f32>, // Cube's vertex position
};

// Hash function to generate pseudo-random numbers based on instanceIndex
fn rand(seed: f32) -> f32 {
    let scaledSeed = seed * 0.01; // Scale down the seed
    let t = fract(sin(scaledSeed) * 43758.5453);
    return t;
}

fn plot(st: vec2<f32>, pct: f32) -> f32 {
    return smoothstep(pct - 0.9, pct, st.y) - smoothstep(pct, pct + 0.9, st.y);
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

    // Define the fixed grid width (512 columns) and cube size (0.05)
    let gridWidth: f32 = 512.0;
    let cubeSize: f32 = 0.05; // Size of each cube

    // Calculate the column (x position) and row (z position) for the grid
    let column = f32(instanceIndex % u32(gridWidth));  // X position (column) within the row
    let row = f32(instanceIndex / u32(gridWidth));     // Z position (row)

    // Adjust the x and z position to center the grid
    transformedPosition.x += (column - gridWidth / 2.0) * cubeSize; // Center cubes horizontally
    transformedPosition.z += (row - rowCount / 2.0) * cubeSize;     // Center cubes vertically

    // Generate a pseudo-random value for the height using instanceIndex as seed
    let randomHeight = rand(f32(instanceIndex)) * 10.0; // Random value between 0 and 10
    let baseY = 0.0; // Set the baseline Y position to 0 for all cubes

    // Calculate 'st' and 'y' for the plot function
    let st = (vec2(row, column) / vec2(rowCount, gridWidth));
    let y = (sin(st.x * 6.28318 + time / 1000.0) + 1.0) / 2.0;

    // Plot a line
    let pct = plot(st, y);

    // Update the Y position to simulate varying cube heights
    transformedPosition.y = baseY + vertexInput.position.y * pct * 7.0 * randomHeight;

    // **Compute normalized height for color interpolation**
    let minHeight = 0.0; // Adjust based on your cube's min height
    let maxHeight = 3.5;  // Adjust based on your cube's max height
    let normalizedHeight = clamp(
        (transformedPosition.y - minHeight) / (maxHeight - minHeight),
        0.0,
        1.0
    );

    // **Create a heat map color based on normalized height**
    var color: vec3<f32>;
    if (normalizedHeight < 0.25) {
        // From blue to cyan
        let t = normalizedHeight / 0.25;
        color = mix(vec3<f32>(0.0, 0.0, 1.0), vec3<f32>(0.0, 1.0, 1.0), t);
    } else if (normalizedHeight < 0.5) {
        // From cyan to green
        let t = (normalizedHeight - 0.25) / 0.25;
        color = mix(vec3<f32>(0.0, 1.0, 1.0), vec3<f32>(0.0, 1.0, 0.0), t);
    } else if (normalizedHeight < 0.75) {
        // From green to yellow
        let t = (normalizedHeight - 0.5) / 0.25;
        color = mix(vec3<f32>(0.0, 1.0, 0.0), vec3<f32>(1.0, 1.0, 0.0), t);
    } else {
        // From yellow to red
        let t = (normalizedHeight - 0.75) / 0.25;
        color = mix(vec3<f32>(1.0, 1.0, 0.0), vec3<f32>(1.0, 0.0, 0.0), t);
    }

    // Apply the model-view-projection matrix to position the vertex in the scene
    output.Position = mvpMatrix * transformedPosition;
    
    // Pass the color to the fragment shader
    output.vColor = vec4<f32>(color, 1.0);

    return output;
}

@fragment
fn fs_main(@location(0) vColor: vec4<f32>) -> @location(0) vec4<f32> {
    return vColor;
}
`;
