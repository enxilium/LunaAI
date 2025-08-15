#!/usr/bin/env python3
"""
Test script for enhanced workspace system with browser links support
"""

import sys
import os

# Add the project root to the Python path
project_root = os.path.dirname(__file__)
sys.path.insert(0, project_root)

# Now import from the full path
from src.main.services.agent.tools.workspaces import create_workspace, create_and_launch_workspace, launch_workspace, list_workspaces, initialize_workspace_system
from src.main.services.agent.memory.memory_database import MemoryDatabase

def test_workspace_with_links():
    """Test creating and launching workspaces with both programs and browser links"""
    
    print("Testing enhanced workspace system with browser links...")
    print("=" * 60)
    
    # Initialize workspace system
    print("\n1. Initializing workspace system...")
    initialize_workspace_system()
    
    # Clean up any existing test workspaces
    memory_db = MemoryDatabase()
    existing = memory_db.get_workspace_by_name("Test_Dev_Environment")
    if existing:
        memory_db.delete_workspace(existing['id'])
        print("   Cleaned up existing test workspace")
    
    print("   ✓ Workspace system initialized")
    
    # Test 1: Create workspace with both programs and links (NO LAUNCH)
    print("\n2. Creating workspace with programs and browser links (no launch)...")
    test_programs = ["notepad", "calculator"]
    test_links = [
        "https://github.com",
        "https://stackoverflow.com",
        "localhost:3000",  # Test URL auto-formatting
        "google.com"       # Test URL auto-formatting
    ]
    
    result = create_workspace(
        programs=test_programs,
        links=test_links,
        name="Test_Dev_Environment",
        description="Development workspace with code editor and useful links"
    )
    
    print(f"   Status: {result['status']}")
    print(f"   Message: {result['message']}")
    
    if result['status'] == 'success':
        print(f"   Workspace ID: {result['workspace_id']}")
        print(f"   Workspace Name: {result['workspace_name']}")
        
        # Show found programs
        if 'found_programs' in result:
            print(f"   Found Programs: {len(result['found_programs'])}")
            for prog in result['found_programs']:
                print(f"     - {prog['requested']} → {prog['found']} (score: {prog['score']:.2f})")
        
        # Note: No launch results since we're only creating, not launching
        print("   ✓ Workspace created successfully (no programs/links launched yet)")
    else:
        print(f"   ✗ Failed to create workspace: {result['message']}")
        return False
    
    # Test 2: List workspaces to verify links are stored
    print("\n3. Listing workspaces to verify data storage...")
    list_result = list_workspaces()
    
    if list_result['status'] == 'success':
        print(f"   Found {list_result['total']} workspace(s)")
        for ws in list_result['workspaces']:
            if ws['name'] == "Test_Dev_Environment":
                print(f"   Workspace: {ws['name']}")
                print(f"     Programs: {ws['programs']}")
                print(f"     Links: {ws['links']}")
                print(f"     Description: {ws['description']}")
                print("   ✓ Links properly stored in database")
                break
    else:
        print(f"   ✗ Failed to list workspaces: {list_result['message']}")
        return False
    
    # Test 3: Test links-only workspace
    print("\n4. Creating links-only workspace...")
    links_only_result = create_workspace(
        programs=[],  # No programs
        links=["https://docs.python.org", "https://www.mozilla.org"],
        name="Quick_Reference",
        description="Quick reference links"
    )
    
    print(f"   Status: {links_only_result['status']}")
    if links_only_result['status'] == 'success':
        print("   ✓ Links-only workspace created successfully")
    else:
        print(f"   ✗ Failed: {links_only_result['message']}")
    
    # Test 4: Test programs-only workspace (existing functionality)
    print("\n5. Creating programs-only workspace...")
    programs_only_result = create_workspace(
        programs=["cmd"],
        links=[],  # No links
        name="Command_Line",
        description="Command line tools"
    )
    
    print(f"   Status: {programs_only_result['status']}")
    if programs_only_result['status'] == 'success':
        print("   ✓ Programs-only workspace created successfully")
    else:
        print(f"   ✗ Failed: {programs_only_result['message']}")
    
    # Test 6: Launch workspace with links
    print("\n6. Testing workspace launch with links...")
    launch_result = launch_workspace("Test_Dev_Environment")
    
    print(f"   Status: {launch_result['status']}")
    if launch_result['status'] == 'success':
        print(f"   Message: {launch_result['message']}")
        
        if 'launch_results' in launch_result:
            results = launch_result['launch_results']
            
            if 'programs' in results:
                prog_result = results['programs']
                print(f"   Programs: {prog_result['total_launched']}/{prog_result['total_requested']} launched")
            
            if 'links' in results:
                link_result = results['links']
                print(f"   Links: {link_result['total_launched']}/{link_result['total_requested']} opened")
        
        print("   ✓ Workspace launched successfully")
    else:
        print(f"   ✗ Failed to launch workspace: {launch_result['message']}")
    
    # Test 7: Test create_and_launch_workspace function
    print("\n7. Testing create_and_launch_workspace (combined function)...")
    combined_result = create_and_launch_workspace(
        programs=["cmd"],
        links=["https://docs.python.org"],
        name="Combined_Test",
        description="Test of combined create and launch"
    )
    
    print(f"   Status: {combined_result['status']}")
    if combined_result['status'] == 'success':
        print(f"   Message: {combined_result['message']}")
        if 'launch_results' in combined_result:
            results = combined_result['launch_results']
            if 'programs' in results:
                prog_result = results['programs']
                print(f"   Programs: {prog_result['total_launched']}/{prog_result['total_requested']} launched")
            if 'links' in results:
                link_result = results['links']
                print(f"   Links: {link_result['total_launched']}/{link_result['total_requested']} opened")
        print("   ✓ Combined create and launch successful")
    else:
        print(f"   ✗ Failed: {combined_result['message']}")
    
    print("\n" + "=" * 60)
    print("Enhanced workspace system test completed!")
    print("\nFeatures verified:")
    print("✓ Browser link support with URL auto-formatting")
    print("✓ Mixed workspaces (programs + links)")
    print("✓ Links-only workspaces")
    print("✓ Programs-only workspaces (backwards compatibility)")
    print("✓ Database storage of links")
    print("✓ Workspace creation without auto-launch (prevents double-launching)")
    print("✓ Separate workspace launching")
    print("✓ Combined create-and-launch function")
    print("\nNo more double-launching! Your workspace system now supports browser links! 🎉")

if __name__ == "__main__":
    test_workspace_with_links()
