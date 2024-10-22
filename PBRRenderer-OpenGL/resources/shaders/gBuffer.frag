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

uniform sampler2D texAlbedo;
uniform sampler2D texNormal;
uniform sampler2D texRoughness;
uniform sampler2D texMetalness;
uniform sampler2D texAO;

//因为OpenGL使用的深度值是非线性的，为了得到线性的深度值需要进行逆变换
float LinearizeDepth(float depth)
{
    float z = depth * 2.0f - 1.0f;
    return (2.0f * nearPlane * farPlane) / (farPlane + nearPlane - z * (farPlane - nearPlane));
}

//将法线贴图中的法线向量变换到相机空间中
vec3 computeTexNormal(vec3 viewNormal, vec3 texNormal)
{
	//计算顶点坐标之间的X、Y分量的delta值
    vec3 dPosX = dFdx(viewPos);
    vec3 dPosY = dFdy(viewPos);

	//计算纹理坐标的U、V分量的delta值
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
	//从法线贴图中获得法线向量
    vec3 texNormal = normalize(texture(texNormal, TexCoords).rgb * 2.0f - 1.0f);

	//如果法线贴图使用的是D3D坐标系则Z轴分量需要取相反数
    texNormal.g = -texNormal.g; 

	//计算屏幕空间坐标(准确来讲应该称之为纹理空间坐标。。。。。屏幕空间应该指的是最后gl_FragCoord所代表的坐标)
    vec2 fragPosA = (fragPosition.xy / fragPosition.w) * 0.5f + 0.5f;
    vec2 fragPosB = (fragPrevPosition.xy / fragPrevPosition.w) * 0.5f + 0.5f;

	//输出相机空间坐标以及线性化后的深度值
    gPosition = vec4(viewPos, LinearizeDepth(gl_FragCoord.z));

	//输出从反照率贴图当中采样到的反照率
    gAlbedo.rgb = vec3(texture(texAlbedo, TexCoords));

	//将gAlbedo的a分量赋值为粗糙度来节省贴图数量
    gAlbedo.a = vec3(texture(texRoughness, TexCoords)).r;

	//将从法线贴图中获得的法线转换到切线空间当中
    gNormal.rgb = computeTexNormal(normal, texNormal);
    //gNormal.rgb = normalize(normal);

	//将金属度放到gNormal的a分量中
    gNormal.a = vec3(texture(texMetalness, TexCoords)).r;

	//从环境光吸收贴图中获得值
    gEffects.r = vec3(texture(texAO, TexCoords)).r;

	//计算上一帧与当前帧的像素位移
    gEffects.gb = fragPosA - fragPosB;

	gworldPos = worldPos;
	gworldNormal = worldNormal;
}