#version 400 core

in vec3 cubeCoords;
out vec4 colorOutput;


const float PI = 3.14159265359f;

uniform samplerCube envMap;


void main()
{		
    vec3 N = normalize(cubeCoords);
    vec3 irradianceAccumulation = vec3(0.0f);

    //根据改点的法线向量计算得到切线空间的B、T、N分量
    vec3 upDir = vec3(0.0f, 1.0f, 0.0f);
    vec3 rightDir = cross(upDir, N);
    upDir = cross(N, rightDir);

	//手动模拟积分，采用离散的形式求和
    float sampleOffset = 0.025f;
    float sampleCount = 0.0f;

	//对一个半球体进行二重积分求和
    for(float anglePhi = 0.0f; anglePhi < 2.0f * PI; anglePhi += sampleOffset)
    {
        for(float angleTheta = 0.0f; angleTheta < 0.5f * PI; angleTheta += sampleOffset)
        {
			//通过球面坐标系坐标得到笛卡尔坐标系坐标
            vec3 sampleTangent = vec3(sin(angleTheta) * cos(anglePhi),  sin(angleTheta) * sin(anglePhi), cos(angleTheta));
			//通过BTN矩阵变换到世界坐标系
            vec3 sampleVector = sampleTangent.x * rightDir + sampleTangent.y * upDir + sampleTangent.z * N;
			//根据坐标系从环境贴图中采样
            irradianceAccumulation += texture(envMap, sampleVector).rgb * cos(angleTheta) * sin(angleTheta);
            sampleCount++;
        }
    }
	//取平均值
    irradianceAccumulation = irradianceAccumulation * (1.0f / float(sampleCount)) * PI;
    
    colorOutput = vec4(irradianceAccumulation, 1.0f);
}
