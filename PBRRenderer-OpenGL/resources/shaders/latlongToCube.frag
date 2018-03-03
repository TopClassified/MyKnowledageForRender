#version 330 core
out vec4 FragColor;
in vec3 WorldPos;

uniform sampler2D envMap;

float PI  = 3.14159265359f;

//从立方体的顶点坐标中计算得出圆柱体的采样坐标
vec2 getSphericalCoord(vec3 normalCoord)
{
    float phi = acos(-normalCoord.y);
    float theta = atan(1.0f * normalCoord.x, -normalCoord.z) + PI;

    return vec2(theta / (2.0f * PI), phi / PI);
}

void main()
{		
    vec2 uv = getSphericalCoord(normalize(WorldPos));
    vec3 color = texture(envMap, uv).rgb;
    
    FragColor = vec4(color, 1.0);
}
