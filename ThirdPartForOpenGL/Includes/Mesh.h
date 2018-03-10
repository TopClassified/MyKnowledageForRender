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

//声明顶点结构体
struct Vertex 
{
	// 顶点坐标
	glm::vec3 Position;
	// 顶点法向量
	glm::vec3 Normal;
	// 顶点纹理坐标
	glm::vec2 TexCoords;
};

//声明纹理结构体
struct Texture 
{
	GLuint id;
	string type;
	aiString path;
};

class Mesh 
{
public:
	//一个网格会有多个顶点，所以就会有多组索引，也可以同时有多个纹理
	vector<Vertex> vertices;
	vector<GLuint> indices;
	vector<Texture> textures;

	// 构造函数，把通过Assimp读取的数据保存下来
	Mesh(vector<Vertex> vertices, vector<GLuint> indices, vector<Texture> textures)
	{
		this->vertices = vertices;
		this->indices = indices;
		this->textures = textures;

		// 得到数据后，设置顶点缓冲和属性指针
		this->setupMesh();
	}

	// Render the mesh
	void Draw(Shader shader)
	{
		// 绑定合适的纹理
		GLuint diffuseNr = 1;
		GLuint specularNr = 1;
		GLuint reflectionNr = 1;
		for (GLuint i = 0; i < this->textures.size(); i++)
		{
			glActiveTexture(GL_TEXTURE0 + i); // 再绑定之前激活相应的纹理单元
			stringstream ss;
			string number;
			string name = this->textures[i].type;
			if (name == "texture_diffuse")
				ss << diffuseNr++; 
			else if (name == "texture_specular")
				ss << specularNr++;
			else if (name == "texture_reflection")
				ss << reflectionNr++;
			number = ss.str();//.str()，从ss中读取字符串数据
			// 设置采样器对应正确的纹理单元
			glUniform1i(glGetUniformLocation(shader.Program, (name + number).c_str()), i);
			//.c_str()返回一个指向该字符串开头的指针
			// 最后绑定纹理
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
		//offsetof函数，第一个参数是结构体，第二个参数是结构体中的某一属性，返回的是该结构体中该属性所占空间大小
		// Vertex Texture Coords
		glEnableVertexAttribArray(2);
		glVertexAttribPointer(2, 2, GL_FLOAT, GL_FALSE, sizeof(Vertex), (GLvoid*)offsetof(Vertex, TexCoords));

		glBindVertexArray(0);
	}
};



