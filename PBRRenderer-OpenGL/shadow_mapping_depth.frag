#version 330 core

out vec4 color;

void main()
{             
    gl_FragDepth = gl_FragCoord.z;

	color = vec4( vec3(gl_FragDepth), 1.0f );
}