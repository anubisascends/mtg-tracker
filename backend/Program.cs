using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using MtgTracker.Api.Data;
using MtgTracker.Api.Services;

var builder = WebApplication.CreateBuilder(args);

// Database
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlite(builder.Configuration.GetConnectionString("DefaultConnection")));

// JWT Authentication
var jwtSecret = builder.Configuration["Jwt:Secret"] ?? throw new InvalidOperationException("JWT secret not configured");
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidAudience = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret))
        };
    });

builder.Services.AddAuthorization();

// Services
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IEmailService, SmtpEmailService>();
builder.Services.AddScoped<IEventService, EventService>();
builder.Services.AddScoped<IMatchService, MatchService>();
builder.Services.AddScoped<IPlayerService, PlayerService>();
builder.Services.AddScoped<IRegistrationService, RegistrationService>();
builder.Services.AddScoped<IDeckService, DeckService>();
builder.Services.AddScoped<IPlayerDeckService, PlayerDeckService>();

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo { Title = "MTG Tracker API", Version = "v1" });
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        In = ParameterLocation.Header,
        Description = "Enter: Bearer {token}",
        Name = "Authorization",
        Type = SecuritySchemeType.ApiKey
    });
    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme { Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" } },
            Array.Empty<string>()
        }
    });
});

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
        policy.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader());
});

var app = builder.Build();

// Run migrations and seed admin on startup
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.Migrate();

    var adminEmail = builder.Configuration["AdminSeed:Email"];
    var adminPassword = builder.Configuration["AdminSeed:Password"];
    var adminUsername = builder.Configuration["AdminSeed:Username"] ?? "admin";

    if (!string.IsNullOrEmpty(adminEmail) && !string.IsNullOrEmpty(adminPassword)
        && !db.Users.Any(u => u.Role == "admin"))
    {
        db.Users.Add(new MtgTracker.Api.Models.User
        {
            Username = adminUsername,
            Email = adminEmail.ToLower(),
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(adminPassword),
            Role = "admin",
            CreatedAt = DateTime.UtcNow
        });
        db.SaveChanges();
    }

    if (builder.Configuration["SeedSampleData"] == "true")
        MtgTracker.Api.Data.DevDataSeeder.Seed(db);
}

app.UseSwagger();
app.UseSwaggerUI();

app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();
