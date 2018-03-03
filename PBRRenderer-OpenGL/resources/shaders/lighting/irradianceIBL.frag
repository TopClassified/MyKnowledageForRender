#version 400 core

in vec3 cubeCoords;
out vec4 colorOutput;


const float PI = 3.14159265359f;

uniform samplerCube envMap;


void main()
{		
    vec3 N = normalize(cubeCoords);
    vec3 irradianceAccumulation = vec3(0.0f);

    //���ݸĵ�ķ�����������õ����߿ռ��B��T��N����
    vec3 upDir = vec3(0.0f, 1.0f, 0.0f);
    vec3 rightDir = cross(upDir, N);
    upDir = cross(N, rightDir);

	//�ֶ�ģ����֣�������ɢ����ʽ���
    float sampleOffset = 0.025f;
    float sampleCount = 0.0f;

	//��һ����������ж��ػ������
    for(float anglePhi = 0.0f; anglePhi < 2.0f * PI; anglePhi += sampleOffset)
    {
        for(float angleTheta = 0.0f; angleTheta < 0.5f * PI; angleTheta += sampleOffset)
        {
			//ͨ����������ϵ����õ��ѿ�������ϵ����
            vec3 sampleTangent = vec3(sin(angleTheta) * cos(anglePhi),  sin(angleTheta) * sin(anglePhi), cos(angleTheta));
			//ͨ��BTN����任����������ϵ
            vec3 sampleVector = sampleTangent.x * rightDir + sampleTangent.y * upDir + sampleTangent.z * N;
			//��������ϵ�ӻ�����ͼ�в���
            irradianceAccumulation += texture(envMap, sampleVector).rgb * cos(angleTheta) * sin(angleTheta);
            sampleCount++;
        }
    }
	//ȡƽ��ֵ
    irradianceAccumulation = irradianceAccumulation * (1.0f / float(sampleCount)) * PI;
    
    colorOutput = vec4(irradianceAccumulation, 1.0f);
}
