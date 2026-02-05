const shader = `
// Kinetic Curves - Wavy Lines and Flows
// Theme: Smooth curves, sine waves, fluid motion
//
// ISF_INPUTS: u_mode(long,0,0,2), u_line_count(float,10.0,1.0,50.0), u_amplitude(float,0.5,0.0,2.0), u_frequency(float,2.0,0.1,10.0), u_speed(float,1.0,0.0,5.0)

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    vec2 p = uv;
    p.x *= iResolution.x / iResolution.y;

    // Placeholder Logic
    vec3 col = vec3(0.0);
    
    // Simple sine wave
    float y = sin(p.x * 10.0 + iTime) * 0.1 + 0.5;
    float d = abs(p.y - y);
    
    col = vec3(smoothstep(0.02, 0.01, d));

    fragColor = vec4(col, 1.0);
}

`;