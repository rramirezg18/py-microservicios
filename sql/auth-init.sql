-- Crea DB si no existe
IF DB_ID('AuthDb') IS NULL
BEGIN
  CREATE DATABASE AuthDb;
END;
GO

USE AuthDb;
GO

-- Crea tabla Roles
IF OBJECT_ID('dbo.Roles','U') IS NULL
BEGIN
  CREATE TABLE dbo.Roles(
    Id INT IDENTITY(1,1) PRIMARY KEY,
    Name NVARCHAR(64) NOT NULL UNIQUE,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CreatedBy INT NOT NULL DEFAULT 0,
    UpdatedAt DATETIME2 NULL,
    UpdatedBy INT NOT NULL DEFAULT 0
  );
END;
GO

-- Crea tabla Users
IF OBJECT_ID('dbo.Users','U') IS NULL
BEGIN
  CREATE TABLE dbo.Users(
    Id INT IDENTITY(1,1) PRIMARY KEY,
    Username NVARCHAR(64) NOT NULL UNIQUE,
    Password NVARCHAR(256) NOT NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CreatedBy INT NOT NULL DEFAULT 0,
    UpdatedAt DATETIME2 NULL,
    UpdatedBy INT NOT NULL DEFAULT 0,
    RoleId INT NOT NULL,
    CONSTRAINT FK_Users_Roles FOREIGN KEY(RoleId) REFERENCES dbo.Roles(Id) ON DELETE CASCADE
  );
END;
GO

-- Roles base
IF NOT EXISTS(SELECT 1 FROM dbo.Roles WHERE Name='Admin')
  INSERT INTO dbo.Roles(Name,CreatedBy,UpdatedBy) VALUES('Admin',0,0);
IF NOT EXISTS(SELECT 1 FROM dbo.Roles WHERE Name='User')
  INSERT INTO dbo.Roles(Name,CreatedBy,UpdatedBy) VALUES('User',0,0);
GO

-- Usuario admin (username: admin / password: Admin!2025)
-- Hash BCrypt de 'Admin!2025'
DECLARE @adminHash NVARCHAR(256) =
  N'$2b$10$qfI1M/KhLClASzUbzLcZ7eqYpmL6u/ha.xdsEHYb3tKZvUVe.hoqO';

DECLARE @adminRoleId INT = (SELECT TOP 1 Id FROM dbo.Roles WHERE Name='Admin');

IF NOT EXISTS(SELECT 1 FROM dbo.Users WHERE Username='admin')
BEGIN
  INSERT INTO dbo.Users(Username,Password,RoleId,CreatedBy,UpdatedBy)
  VALUES('admin', @adminHash, @adminRoleId, 0, 0);
END
ELSE
BEGIN
  UPDATE dbo.Users SET Password=@adminHash, RoleId=@adminRoleId WHERE Username='admin';
END;
GO

-- Resultado de verificación
SELECT u.Username, r.Name AS RoleName
FROM dbo.Users u
JOIN dbo.Roles r ON r.Id = u.RoleId
WHERE u.Username='admin';
GO
