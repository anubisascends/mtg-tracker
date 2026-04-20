using System.ComponentModel.DataAnnotations;
using MtgTracker.Api.Models;

namespace MtgTracker.Api.DTOs.Events;

public class UpdateEventRequest
{
    [MaxLength(200)]
    public string? Name { get; set; }

    public string? Description { get; set; }

    public string? Format { get; set; }

    public DateTime? Date { get; set; }

    public TimeOnly? StartTime { get; set; }
    public TimeOnly? EndTime { get; set; }

    public EventStatus? Status { get; set; }

    [Range(2, 512)]
    public int? MaxPlayers { get; set; }

    public MtgTracker.Api.Models.EliminationType? EliminationType { get; set; }
    public bool? RequiresDeckRegistration { get; set; }
    public bool? ProxiesAllowed { get; set; }
}
