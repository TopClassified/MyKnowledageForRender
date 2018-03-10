#pragma once
// Std. Includes
#include <string>
#include <fstream>
#include <sstream>
#include <iostream>
#include <vector>
using namespace std;
#include <GL/glew.h> 
#include <glm/glm.hpp>
#include <glm/gtc/matrix_transform.hpp>
#include <GL/Shader.h>

//��������ṹ��
struct Vertex 
{
	// ��������
	glm::vec3 Position;
	// ���㷨����
	glm::vec3 Normal;
	// ������������
	glm::vec2 TexCoords;
};

//��������ṹ��
struct Texture 
{
	GLuint id;
	string type;
	aiString path;
};

class Mesh 
{
public:
	//һ��������ж�����㣬���Ծͻ��ж���������Ҳ����ͬʱ�ж������
	vector<Vertex> vertices;
	vector<GLuint> indices;
	vector<Texture> textures;

	// ���캯������ͨ��Assimp��ȡ�����ݱ�������
	Mesh(vector<Vertex> vertices, vector<GLuint> indices, vector<Texture> textures)
	{
		this->vertices = vertices;
		this->indices = indices;
		this->textures = textures;

		// �õ����ݺ����ö��㻺�������ָ��
		this->setupMesh();
	}

	// Render the mesh
	void Draw(Shader shader)
	{
		// �󶨺��ʵ�����
		GLuint diffuseNr = 1;
		GLuint specularNr = 1;
		GLuint reflectionNr = 1;
		for (GLuint i = 0; i < this->textures.size(); i++)
		{
			glActiveTexture(GL_TEXTURE0 + i); // �ٰ�֮ǰ������Ӧ������Ԫ
			stringstream ss;
			string number;
			string name = this->textures[i].type;
			if (name == "texture_diffuse")
				ss << diffuseNr++; 
			else if (name == "texture_specular")
				ss << specularNr++;
			else if (name == "texture_reflection")
				ss << reflectionNr++;
			number = ss.str();//.str()����ss�ж�ȡ�ַ�������
			// ���ò�������Ӧ��ȷ������Ԫ
			glUniform1i(glGetUniformLocation(shader.Program, (name + number).c_str()), i);
			//.c_str()����һ��ָ����ַ�����ͷ��ָ��
			// ��������
			glBindTexture(GL_TEXTURE_2D, this->textures[i].id);
		}

		// Also set each mesh's shininess property to a default value (if you want you could extend this to another mesh property and possibly change this value)
		glUniform1f(glGetUniformLocation(shader.Program, "material.shininess"), 16.0f);

		// Draw mesh
		glBindVertexArray(this->VAO);
		glDrawElements(GL_TRIANGLES, this->indices.size(), GL_UNSIGNED_INT, 0);
		glBindVertexArray(0);

		// Always good practice to set everything back to defaults once configured.
		for (GLuint i = 0; i < this->textures.size(); i++)
		{
			glActiveTexture(GL_TEXTURE0 + i);
			glBindTexture(GL_TEXTURE_2D, 0);
		}
	}

	GLuint getVAO()
	{
		return this->VAO;
	}

private:
	GLuint VAO, VBO, EBO;

	void setupMesh()
	{
		glGenVertexArrays(1, &this->VAO);
		glGenBuffers(1, &this->VBO);
		glGenBuffers(1, &this->EBO);

		glBindVertexArray(this->VAO);
		glBindBuffer(GL_ARRAY_BUFFER, this->VBO);
		// A great thing about structs is that their memory layout is sequential for all its items.
		// The effect is that we can simply pass a pointer to the struct and it translates perfectly to a glm::vec3/2 array which
		// again translates to 3/2 floats which translates to a byte array.
		glBufferData(GL_ARRAY_BUFFER, this->vertices.size() * sizeof(Vertex), &this->vertices[0], GL_STATIC_DRAW);

		glBindBuffer(GL_ELEMENT_ARRAY_BUFFER, this->EBO);
		glBufferData(GL_ELEMENT_ARRAY_BUFFER, this->indices.size() * sizeof(GLuint), &this->indices[0], GL_STATIC_DRAW);

		// Vertex Positions
		glEnableVertexAttribArray(0);
		glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, sizeof(Vertex), (GLvoid*)0);
		// Vertex Normals
		glEnableVertexAttribArray(1);
		glVertexAttribPointer(1, 3, GL_FLOAT, GL_FALSE, sizeof(Vertex), (GLvoid*)offsetof(Vertex, Normal));
		//offsetof��������һ�������ǽṹ�壬�ڶ��������ǽṹ���е�ĳһ���ԣ����ص��Ǹýṹ���и�������ռ�ռ��С
		// Vertex Texture Coords
		glEnableVertexAttribArray(2);
		glVertexAttribPointer(2, 2, GL_FLOAT, GL_FALSE, sizeof(Vertex), (GLvoid*)offsetof(Vertex, TexCoords));

		glBindVertexArray(0);
	}
};



