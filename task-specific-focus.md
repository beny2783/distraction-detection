# Task-Specific Focus Feature

## Overview

The Task-Specific Focus feature enhances the Focus Nudge extension by allowing users to define specific tasks they want to focus on, rather than just tracking general browsing behavior. This enables the system to provide more contextual distraction detection and personalized nudges based on the user's current goals.

## Problem Statement

Currently, the Focus Nudge extension can only track browsing at the domain level. For example, it knows when a user is on LinkedIn but cannot distinguish between productive activities (like applying to jobs) and potentially distracting activities (like scrolling the social feed) on the same website.

## Feature Description

The Task-Specific Focus feature will allow users to:

1. **Declare specific tasks** they want to focus on (e.g., "Apply to jobs on LinkedIn")
2. **Set time boundaries** for these tasks (e.g., "For the next 2 hours")
3. **Receive contextual nudges** when they deviate from their declared task
4. **View task-specific metrics** on their productivity and distraction levels

## Implementation Details

### User Interface Enhancements

- Add a "Set Focus Task" button to the popup interface
- Create a task configuration modal with:
  - Task description field
  - Website/domain selection
  - Time duration selector
  - Optional: Specific URL paths to consider "on-task"
- Add task-specific visualization to the insights page

### Technical Components

1. **URL Path Analysis**
   - Track not just domains but specific URL paths and parameters
   - Create patterns for recognizing task-relevant pages

2. **Content Analysis**
   - Implement lightweight content analysis to detect task-relevant elements
   - Identify forms, specific page types, and user actions related to the task

3. **Task Session Management**
   - Create and track task sessions with specific start/end conditions
   - Store task-specific metrics separate from general browsing metrics

4. **Enhanced Distraction Scoring**
   - Modify the distraction scoring algorithm to consider the declared task
   - Score browsing behavior in the context of task relevance

5. **Contextual Nudges**
   - Generate nudges that specifically reference the current task
   - Provide more actionable suggestions to return to the task

## User Experience Flow

1. User clicks "Set Focus Task" in the popup
2. User configures their task: "Apply to jobs on LinkedIn for 2 hours"
3. System enters task-specific monitoring mode
4. When user deviates (e.g., browsing LinkedIn feed instead of job listings):
   - Distraction score increases
   - User receives a contextual nudge: "You've spent 10 minutes on the LinkedIn feed instead of applying to jobs"
5. After the session, user can view insights specific to their task:
   - Time spent on task vs. off task
   - Number of distractions
   - Task-specific focus score

## Privacy Considerations

- All content analysis happens locally in the browser
- No sensitive form data is collected or stored
- Users can opt out of content analysis while still using basic task tracking

## Success Metrics

- Increase in time spent on declared tasks
- Reduction in distractions during task sessions
- User-reported satisfaction with task completion
- Engagement with task-specific insights

## Future Enhancements

- Machine learning to automatically detect common tasks
- Integration with productivity tools and calendars
- Task templates for common activities (job hunting, research, learning)
- Task-specific distraction blocking options 