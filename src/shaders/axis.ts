export const axisShader = `
@group(0) @binding(0) var<uniform> mvpMatrix : mat4x4<f32>;

struct VertexOutput {
    @builtin(position) Position : vec4<f32>,
    @location(0) vColor : vec4<f32>,
};

@vertex
fn vs_main(@builtin(vertex_index) VertexIndex: u32) -> VertexOutput {

    let gridSize = 13.5 / 2.0;
    // let gridSize = 13.5

    // Define positions for X, Y, Z axes
    var pos = array<vec3<f32>, 6>(
        // X-axis (horizontal along X, Z = 0, Y = 0)
        vec3<f32>(-gridSize, 0.0, -gridSize),  // Start of X-axis
        vec3<f32>(gridSize, 0.0, -gridSize),   // End of X-axis

        // Y-axis (vertical along Y, X = 0, Z = 0)
        vec3<f32>(-gridSize, 0.0, -gridSize),  // Bottom of Y-axis
        vec3<f32>(-gridSize, gridSize, -gridSize),   // Top of Y-axis

        // Z-axis (depth along Z, X = 0, Y = 0)
        vec3<f32>(-gridSize, 0.0, -gridSize),  // Start of Z-axis
        vec3<f32>(-gridSize, 0.0, gridSize)    // End of Z-axis
    );

    // Define colors for each axis
    var colors = array<vec4<f32>, 6>(
        vec4<f32>(1.0, 0.0, 0.0, 1.0),  // Red for X-axis
        vec4<f32>(1.0, 0.0, 0.0, 1.0),  // Red for X-axis
        vec4<f32>(0.0, 1.0, 0.0, 1.0),  // Green for Y-axis
        vec4<f32>(0.0, 1.0, 0.0, 1.0),  // Green for Y-axis
        vec4<f32>(0.0, 0.0, 1.0, 1.0),  // Blue for Z-axis
        vec4<f32>(0.0, 0.0, 1.0, 1.0)   // Blue for Z-axis
    );

    var output: VertexOutput;
    // Transform the position using the MVP matrix
    output.Position = mvpMatrix * vec4<f32>(pos[VertexIndex], 1.0);
    // Assign the color based on the vertex index
    output.vColor = colors[VertexIndex];
    return output;
}

@fragment
fn fs_main(@location(0) vColor: vec4<f32>) -> @location(0) vec4<f32> {
    return vColor;
}
`;
