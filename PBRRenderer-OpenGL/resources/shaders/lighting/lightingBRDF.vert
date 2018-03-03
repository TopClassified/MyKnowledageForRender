#version 400 core

layout (location = 0) in vec3 position;
layout (location = 1) in vec2 texCoords;

out vec2 TexCoords;
out vec3 envMapCoords;
out mat4 LightSpaceMatrix;

uniform mat4 inverseView;
uniform mat4 inverseProj;
uniform mat4 lightSpaceMatrix;

void main()
{
    TexCoords = texCoords;
	//����Ļ�ռ�任������ռ�
    vec4 unprojCoords = (inverseProj * vec4(position, vec2(1.0f)));
	//������ռ�任������ռ�Ӷ��������Ĳ�������
    envMapCoords = (inverseView * unprojCoords).xyz;

	LightSpaceMatrix = lightSpaceMatrix;

    gl_Position = vec4(position, 1.0f);
}
