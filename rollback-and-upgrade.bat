@echo off
echo ===== ROLLBACK TO SCENARIO A =====

echo Deleting current rollouts and services...
kubectl delete rollout caller receiver || true
kubectl delete service caller caller-canary receiver receiver-canary receiver-stable || true

echo Waiting for resources to be deleted...
timeout /t 5

echo Applying Scenario A (Initial Deployment)...
kubectl apply -f scenario-a-initial/caller-rollout.yaml
kubectl apply -f scenario-a-initial/receiver-rollout.yaml

echo Waiting for rollouts to be available...
kubectl wait --for=condition=available rollout/caller rollout/receiver --timeout=60s

echo ===== SCENARIO A DEPLOYED SUCCESSFULLY =====
echo.
echo To apply Scenario B (Canary Upgrade), run:
echo rollback-and-upgrade.bat upgrade
echo.

if "%1"=="upgrade" (
  echo ===== APPLYING SCENARIO B UPGRADE =====
  
  echo Applying Scenario B (Canary Upgrade)...
  kubectl apply -f scenario-b-upgrade/caller-rollout.yaml
  kubectl apply -f scenario-b-upgrade/receiver-rollout.yaml
  
  echo Checking status of canary rollouts...
  kubectl argo rollouts get rollout caller
  kubectl argo rollouts get rollout receiver
  
  echo.
  echo ===== SCENARIO B UPGRADE IN PROGRESS =====
  echo.
  echo Use the following commands to check status:
  echo   kubectl argo rollouts get rollout caller
  echo   kubectl argo rollouts get rollout receiver
  echo.
  echo To promote rollouts immediately:
  echo   kubectl argo rollouts promote caller
  echo   kubectl argo rollouts promote receiver
)
