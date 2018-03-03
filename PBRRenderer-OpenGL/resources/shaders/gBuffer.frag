#version 400 core

layout (location = 0) out vec4 gPosition;
layout (location = 1) out vec4 gAlbedo;
layout (location = 2) out vec4 gNormal;
layout (location = 3) out vec3 gEffects;
layout (location = 4) out vec4 gworldPos;
layout (location = 5) out vec3 gworldNormal;

in vec3 viewPos;
in vec2 TexCoords;
in vec3 normal;
in vec4 fragPosition;
in vec4 fragPrevPosition;

in vec4 worldPos;
in vec3 worldNormal;

const float nearPlane = 1.0f;
const float farPlane = 1000.0f;

uniform vec3 albedoColor;
uniform sampler2D texAlbedo;
uniform sampler2D texNormal;
uniform sampler2D texRoughness;
uniform sampler2D texMetalness;
uniform sampler2D texAO;

//��ΪOpenGLʹ�õ����ֵ�Ƿ����Եģ�Ϊ�˵õ����Ե����ֵ��Ҫ������任
float LinearizeDepth(float depth)
{
    float z = depth * 2.0f - 1.0f;
    return (2.0f * nearPlane * farPlane) / (farPlane + nearPlane - z * (farPlane - nearPlane));
}

//����ģ�ʹ���ķ�������������õ���Ӧ�����߿ռ����Ȼ�󽫷�����ͼ�еķ��������任�����߿ռ���
vec3 computeTexNormal(vec3 viewNormal, vec3 texNormal)
{
    vec3 dPosX  = dFdx(viewPos);
    vec3 dPosY  = dFdy(viewPos);
    vec2 dTexX = dFdx(TexCoords);
    vec2 dTexY = dFdy(TexCoords);

    vec3 normal = normalize(viewNormal);
    vec3 tangent = normalize(dPosX * dTexY.t - dPosY * dTexX.t);
    vec3 binormal = -normalize(cross(normal, tangent));
    mat3 TBN = mat3(tangent, binormal, normal);

    return normalize(TBN * texNormal);
}

void main()
{
	//�ӷ�����ͼ�л�÷�������
    vec3 texNormal = normalize(texture(texNormal, TexCoords).rgb * 2.0f - 1.0f);
	//���������ͼʹ�õ���D3D����ϵ��Z�������Ҫȡ�෴��
    texNormal.g = -texNormal.g; 

	//�ֶ�����ͶӰ����ӳ�䣬����ֵ��[-1,1]�޶���[0,1]֮��
    vec2 fragPosA = (fragPosition.xy / fragPosition.w) * 0.5f + 0.5f;
    vec2 fragPosB = (fragPrevPosition.xy / fragPrevPosition.w) * 0.5f + 0.5f;

	//�������ռ������Լ����Ի�������ֵ
    gPosition = vec4(viewPos, LinearizeDepth(gl_FragCoord.z));

	//����ӷ�������ͼ���в������ķ�����
    gAlbedo.rgb = vec3(texture(texAlbedo, TexCoords));
    //gAlbedo.rgb = vec3(albedoColor);

	//��gAlbedo��a������ֵΪ�ֲڶ�����ʡ��ͼ����
    gAlbedo.a = vec3(texture(texRoughness, TexCoords)).r;

	//���ӷ�����ͼ�л�õķ���ת�������߿ռ䵱��
    gNormal.rgb = computeTexNormal(normal, texNormal);
    //gNormal.rgb = normalize(normal);
	//�������ȷŵ�gNormal��a������
    gNormal.a = vec3(texture(texMetalness, TexCoords)).r;

	//�ӻ�����������ͼ�л��ֵ
    gEffects.r = vec3(texture(texAO, TexCoords)).r;
    gEffects.gb = fragPosA - fragPosB;

	gworldPos = worldPos;
	gworldNormal = worldNormal;
}