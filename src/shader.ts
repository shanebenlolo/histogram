export const shader = `
struct Uniforms {
    mvpMatrix : mat4x4<f32>,
};

@group(0) @binding(0) var<uniform> uniforms : Uniforms;

struct Output {
    @builtin(position) Position : vec4<f32>,
    @location(0) vColor : vec4<f32>,
};

@vertex
fn vs_main(
    @builtin(instance_index) instanceIndex: u32,
    @location(0) pos: vec4<f32>,
    @location(1) color: vec4<f32>
 ) -> Output {
    var output: Output;

    // ignore the 5.0, and 2.0 they are just for fun.
    output.Position = (uniforms.mvpMatrix * pos - f32(instanceIndex)/5.0)+2.0;
    
    output.vColor = color;
    return output;
}

 @fragment
fn fs_main(@location(0) vColor: vec4<f32>) -> @location(0) vec4<f32> {
    return vColor;
}
`;
