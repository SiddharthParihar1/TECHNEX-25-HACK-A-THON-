using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.AI;
using TMPro;

public class SetValueFromDropDown : MonoBehaviour
{
    [SerializeField] private TMP_Dropdown dropdown;
    [SerializeField] private Transform playerTransform;  // The transform of the player or object representing the current position
    [SerializeField] private LineRenderer lineRenderer;  // The LineRenderer component to draw the path
    [SerializeField] private NavMeshAgent navMeshAgent;  // The NavMeshAgent component for pathfinding

    // A dictionary to map dropdown options to GameObjects in the scene
    private Dictionary<int, GameObject> locationObjects = new Dictionary<int, GameObject>();

    private void Start()
    {
        // Initialize the dictionary with GameObjects corresponding to dropdown options
        locationObjects.Add(1, GameObject.Find("Cube"));
        

        // Setup the dropdown action
        SetActionOfDropdown();
    }

    public void GetDropdownValue()
    {
        int pickedEntryIndex = dropdown.value;
        string selectedOption = dropdown.options[pickedEntryIndex].text;
        Debug.Log(selectedOption);

        // Draw the navigation line when an option is selected
        DrawNavigationLine(pickedEntryIndex);
    }

    public void SetActionOfDropdown()
    {
        dropdown.onValueChanged.AddListener(ActionToCall);
    }

    public void ActionToCall(int selectedIndex)
    {
        Debug.Log("Selected Index: " + selectedIndex);

        // Draw the navigation line when an option is selected
        DrawNavigationLine(selectedIndex);
    }

    private void DrawNavigationLine(int selectedIndex)
    {
        // Ensure the selected index exists in the dictionary
        if (locationObjects.ContainsKey(selectedIndex))
        {
            // Get the selected GameObject
            GameObject selectedObject = locationObjects[selectedIndex];
            Vector3 selectedPosition = selectedObject.transform.position;

            // Calculate the path using the NavMesh
            NavMeshPath path = new NavMeshPath();
            if (NavMesh.CalculatePath(playerTransform.position, selectedPosition, NavMesh.AllAreas, path))
            {
                // Update the LineRenderer with the calculated path
                lineRenderer.positionCount = path.corners.Length;
                lineRenderer.SetPositions(path.corners);

                // Optionally, calculate and log the distance along the path
                float distance = 0f;
                for (int i = 0; i < path.corners.Length - 1; i++)
                {
                    distance += Vector3.Distance(path.corners[i], path.corners[i + 1]);
                }
                Debug.Log("Distance to " + selectedObject.name + ": " + distance + " units.");
            }
            else
            {
                Debug.LogWarning("No valid path found to " + selectedObject.name);
            }
        }
        else
        {
            Debug.LogWarning("Selected index does not have a corresponding GameObject.");
        }
    }

    private void OnDestroy()
    {
        dropdown.onValueChanged.RemoveListener(ActionToCall);
    }
}
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.AI;
using TMPro;

public class SetValueFromDropDown : MonoBehaviour
{
    [SerializeField] private TMP_Dropdown dropdown;
    [SerializeField] private Transform playerTransform;  // The transform of the player or object representing the current position
    [SerializeField] private LineRenderer lineRenderer;  // The LineRenderer component to draw the path
    [SerializeField] private NavMeshAgent navMeshAgent;  // The NavMeshAgent component for pathfinding
    [SerializeField] private GameObject destinationMarker;  // Marker to show the selected destination
    [SerializeField] private TextMeshProUGUI statusText;  // UI text to display status

    // A dictionary to map dropdown options to GameObjects in the scene
    private Dictionary<int, GameObject> locationObjects = new Dictionary<int, GameObject>();

    private void Start()
    {
        // Initialize the dictionary with GameObjects corresponding to dropdown options
        locationObjects.Add(1, GameObject.Find("Cube"));
        locationObjects.Add(2, GameObject.Find("Sphere"));
        locationObjects.Add(3, GameObject.Find("Cylinder"));

        // Setup the dropdown action
        SetActionOfDropdown();

        // Hide the destination marker at the start
        if (destinationMarker != null)
        {
            destinationMarker.SetActive(false);
        }
    }

    public void GetDropdownValue()
    {
        int pickedEntryIndex = dropdown.value;
        string selectedOption = dropdown.options[pickedEntryIndex].text;
        Debug.Log(selectedOption);

        // Draw the navigation line when an option is selected
        DrawNavigationLine(pickedEntryIndex);
    }

    public void SetActionOfDropdown()
    {
        dropdown.onValueChanged.AddListener(ActionToCall);
    }

    public void ActionToCall(int selectedIndex)
    {
        Debug.Log("Selected Index: " + selectedIndex);

        // Draw the navigation line when an option is selected
        DrawNavigationLine(selectedIndex);
    }

    private void DrawNavigationLine(int selectedIndex)
    {
        // Ensure the selected index exists in the dictionary
        if (locationObjects.ContainsKey(selectedIndex))
        {
            // Get the selected GameObject
            GameObject selectedObject = locationObjects[selectedIndex];
            Vector3 selectedPosition = selectedObject.transform.position;

            // Calculate the path using the NavMesh
            NavMeshPath path = new NavMeshPath();
            if (NavMesh.CalculatePath(playerTransform.position, selectedPosition, NavMesh.AllAreas, path))
            {
                // Update the LineRenderer with the calculated path
                lineRenderer.positionCount = path.corners.Length;
                lineRenderer.SetPositions(path.corners);

                // Optionally, calculate and log the distance along the path
                float distance = 0f;
                for (int i = 0; i < path.corners.Length - 1; i++)
                {
                    distance += Vector3.Distance(path.corners[i], path.corners[i + 1]);
                }
                Debug.Log("Distance to " + selectedObject.name + ": " + distance + " units.");

                // Provide feedback to the player
                statusText.text = "Navigating to " + selectedObject.name + ". Distance: " + distance + " units.";

                // Show destination marker at the selected location
                if (destinationMarker != null)
                {
                    destinationMarker.transform.position = selectedPosition;
                    destinationMarker.SetActive(true);
                }
            }
            else
            {
                Debug.LogWarning("No valid path found to " + selectedObject.name);
                statusText.text = "Error: No valid path found!";
            }
        }
        else
        {
            Debug.LogWarning("Selected index does not have a corresponding GameObject.");
            statusText.text = "Error: Invalid selection!";
        }
    }

    private void OnDestroy()
    {
        dropdown.onValueChanged.RemoveListener(ActionToCall);
    }

    // New method to clear path when user changes selection or deselects
    public void ClearNavigationPath()
    {
        lineRenderer.positionCount = 0;

        // Hide destination marker when clearing path
        if (destinationMarker != null)
        {
            destinationMarker.SetActive(false);
        }

        // Reset status text
        if (statusText != null)
        {
            statusText.text = "Select a destination from the dropdown.";
        }
    }
}
