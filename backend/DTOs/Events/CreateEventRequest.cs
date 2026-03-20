using System.ComponentModel.DataAnnotations;
using MtgTracker.Api.Models;

namespace MtgTracker.Api.DTOs.Events;

public class CreateEventRequest
{
    [Required, MaxLength(200)]
    public string Name { get; set; } = string.Empty;

    public string Description { get; set; } = string.Empty;

    [Required]
    public string Format { get; set; } = string.Empty;

    [Required]
    public DateTime Date { get; set; }

    [Range(2, 512)]
    public int MaxPlayers { get; set; } = 8;

    public MtgTracker.Api.Models.EliminationType EliminationType { get; set; } = MtgTracker.Api.Models.EliminationType.Swiss;
    public bool RequiresDeckRegistration { get; set; } = false;
    public bool ProxiesAllowed { get; set; } = false;
}
