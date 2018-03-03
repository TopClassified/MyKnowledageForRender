#version 400 core

layout (location = 0) in vec3 position;
layout (location = 1) in vec3 Normal;
layout (location = 2) in vec2 texCoords;

out vec3 viewPos;
out vec2 TexCoords;
out vec3 normal;
out vec4 fragPosition;
out vec4 fragPrevPosition;

out vec4 worldPos;
out vec3 worldNormal;

uniform mat4 model;
uniform mat4 view;
uniform mat4 projection;
uniform mat4 projViewModel;
uniform mat4 prevProjViewModel;


void main()
{
    //变换到相机空间
    vec4 viewFragPos = view * model * vec4(position, 1.0f);
    viewPos = viewFragPos.xyz;
	
	//传递纹理坐标
    TexCoords = texCoords;

	//如果形状发生改变需要计算法线矩阵来更新顶点的法线
    mat3 normalMatrix = transpose(inverse(mat3(view * model)));
    normal = normalMatrix * Normal;

	//变换到屏幕空间
    fragPosition = projViewModel * vec4(position, 1.0f);
    fragPrevPosition = prevProjViewModel * vec4(position, 1.0f);

	worldPos = model * vec4(position, 1.0f);
	worldNormal = transpose(inverse(mat3(model))) * Normal;

    gl_Position = projection * viewFragPos;
}
