#!/usr/bin/env python3
"""
Debug script for workspace UNIQUE constraint issue
"""

import sys
import os

# Add the project root to the Python path
project_root = os.path.dirname(__file__)
sys.path.insert(0, project_root)

# Now import from the full path
from src.main.services.agent.tools.workspaces import (
    get_workspace_stats, 
    clear_all_workspaces, 
    create_workspace, 
    list_workspaces
)

def debug_workspace_issue():
    """Debug the UNIQUE constraint issue"""
    
    print("=== Workspace Database Debug Session ===")
    
    # Step 1: Check current state
    print("\n1. Checking current workspace database state...")
    stats = get_workspace_stats()
    print(f"   Status: {stats['status']}")
    
    if stats['status'] == 'success':
        stats_data = stats['stats']
        print(f"   Database Path: {stats_data['database_path']}")
        print(f"   Total Workspaces: {stats_data['total_workspaces']}")
        print(f"   Workspace Names: {stats_data['workspace_names']}")
        
        if stats_data['total_workspaces'] > 0:
            print("\n   WARNING: Database is not empty!")
            print("   This could be why you're getting UNIQUE constraint errors.")
            
            # Show detailed list
            print("\n   Detailed workspace list:")
            workspaces_result = list_workspaces()
            if workspaces_result['status'] == 'success':
                for ws in workspaces_result['workspaces']:
                    print(f"     - ID: {ws['id']}, Name: '{ws['name']}', Programs: {ws['programs']}, Links: {ws['links']}")
    
    # Step 2: Clear database completely
    print("\n2. Clearing all workspaces...")
    clear_result = clear_all_workspaces()
    print(f"   Status: {clear_result['status']}")
    print(f"   Message: {clear_result['message']}")
    
    # Step 3: Verify empty state
    print("\n3. Verifying database is empty...")
    stats_after = get_workspace_stats()
    if stats_after['status'] == 'success':
        total_after = stats_after['stats']['total_workspaces']
        print(f"   Workspaces after clear: {total_after}")
        if total_after == 0:
            print("   ✓ Database successfully cleared")
        else:
            print("   ✗ Database still has workspaces!")
            return False
    
    # Step 4: Test creating a workspace with a specific name
    print("\n4. Testing workspace creation...")
    test_name = "Debug_Test_Workspace"
    
    create_result = create_workspace(
        programs=["notepad"],
        name=test_name,
        description="Test workspace for debugging"
    )
    
    print(f"   Status: {create_result['status']}")
    print(f"   Message: {create_result['message']}")
    
    if create_result['status'] == 'success':
        print(f"   ✓ Successfully created workspace '{test_name}'")
        
        # Step 5: Try creating the same workspace again (should fail with UNIQUE constraint)
        print("\n5. Testing duplicate workspace creation (should fail)...")
        duplicate_result = create_workspace(
            programs=["calculator"],
            name=test_name,  # Same name
            description="Duplicate test"
        )
        
        print(f"   Status: {duplicate_result['status']}")
        print(f"   Message: {duplicate_result['message']}")
        
        if duplicate_result['status'] == 'error' and 'UNIQUE constraint' in duplicate_result['message']:
            print("   ✓ UNIQUE constraint error working as expected")
        else:
            print("   ✗ Unexpected result for duplicate creation")
    else:
        print(f"   ✗ Failed to create test workspace: {create_result['message']}")
        return False
    
    # Step 6: Final cleanup
    print("\n6. Final cleanup...")
    final_clear = clear_all_workspaces()
    print(f"   Status: {final_clear['status']}")
    print(f"   Message: {final_clear['message']}")
    
    print("\n=== Debug Session Complete ===")
    print("\nSUMMARY:")
    print("- Fresh database connections are now used for each operation")
    print("- Added clear_all_workspaces() and get_workspace_stats() for debugging") 
    print("- UNIQUE constraint errors should only occur when trying to create")
    print("  workspaces with names that already exist in the database")
    print("\nIf you're still getting UNIQUE constraint errors after clearing,")
    print("it means the workspace name you're trying to create already exists.")
    print("Use get_workspace_stats() to see what's in your database.")
    
    return True

if __name__ == "__main__":
    debug_workspace_issue()
