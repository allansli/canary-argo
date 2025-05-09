# AKS Canary Deployments with Argo Rollouts and Istio

This project demonstrates canary deployment patterns on AKS using Argo Rollouts and Istio, featuring two Node.js microservices:

- **Caller**: Service that calls the receiver using gRPC
- **Receiver**: Backend gRPC service with versioned responses

## Project Structure

- `caller/`: Node.js service that calls `receiver` via gRPC, injects version headers
- `receiver/`: Node.js gRPC server with version-aware routing logic
- `scenario-a-initial/`: Initial deployment YAML files (v1) for both services
- `scenario-b-upgrade/`: Canary upgrade YAML files (v2) with traffic splitting
- `rollback-and-upgrade.bat`: Utility script to reset and upgrade deployments

## Prerequisites

- Kubernetes cluster (AKS) with Istio installed
- Argo Rollouts controller installed
- kubectl with Argo Rollouts plugin (`kubectl argo rollouts`)
- Docker to build and push images

## Service Configuration

### Caller and Receiver Services
- Resource limits: 100m CPU, 64Mi memory
- Container images tagged with version (v1/v2)
- VERSION environment variable (v1/v2) set accordingly

## Deployment Process

### Building and Pushing Images

```sh
# In caller/
docker build -t allansli/caller:v1 .
docker push allansli/caller:v1
docker build -t allansli/caller:v2 .
docker push allansli/caller:v2

# In receiver/
docker build -t allansli/receiver:v1 .
docker push allansli/receiver:v1
docker build -t allansli/receiver:v2 .
docker push allansli/receiver:v2
```

### Deployment Scenarios

#### Scenario A: Initial Deployment (v1)

```sh
kubectl apply -f scenario-a-initial/caller-rollout.yaml
kubectl apply -f scenario-a-initial/receiver-rollout.yaml
```

#### Scenario B: Canary Upgrade (v2)

After Scenario A is deployed and ready:

```sh
kubectl apply -f scenario-b-upgrade/caller-rollout.yaml
kubectl apply -f scenario-b-upgrade/receiver-rollout.yaml
```

The canary deployment will:
1. Send 33% traffic to v2 services
2. Pause for 5 minutes to evaluate
3. Shift 100% traffic to v2 if successful
4. Pause 5 minutes before finalizing

### Monitoring Rollouts

```sh
# Check rollout status
kubectl argo rollouts get rollout caller
kubectl argo rollouts get rollout receiver

# Check pods and their versions
kubectl get pods -l app=caller -o custom-columns=NAME:.metadata.name,VERSION:.metadata.labels.version,IMAGE:.spec.containers[0].image

# Check service endpoints
kubectl get endpoints caller caller-canary
kubectl get endpoints receiver receiver-canary
```

### Promoting or Aborting Canary

```sh
# Immediately promote to 100% traffic
kubectl argo rollouts promote caller
kubectl argo rollouts promote receiver

# Abort and rollback to v1
kubectl argo rollouts abort caller
kubectl argo rollouts abort receiver
```

## Utility Script

A convenience script is provided to reset and perform canary deployments:

```sh
# Reset to Scenario A (v1)
rollback-and-upgrade.bat

# Reset to Scenario A and immediately apply Scenario B (canary)
rollback-and-upgrade.bat upgrade
```

## Troubleshooting

### Pod Pending Issues
- Ensure your cluster has sufficient resources (CPU/memory)
- Check for resource requests/limits in the YAML files
- Consider scaling your cluster if needed

### Rollout Failures
- Check version labels are consistent across pods and services
- Ensure services correctly target pods with matching labels
- Verify that your docker images for v1 and v2 exist

### Istio Connectivity Issues
- Ensure proper mTLS configuration

## Guide for Future Version Upgrades (v2 → v3 → v4, etc.)

This section provides a template for upgrading to new versions beyond the initial v1 → v2 canary deployment.

### 1. Prepare New Version Container Images

```sh
# Build and push new version images (example for v3)
cd caller/
docker build -t allansli/caller:v3 .
docker push allansli/caller:v3

cd ../receiver/
docker build -t allansli/receiver:v3 .
docker push allansli/receiver:v3
```

### 2. Create Upgrade Rollout Files

Create a new scenario directory for your upgrade:

```sh
mkdir -p scenario-c-v3upgrade
```

Copy and modify the rollout templates from the previous version:

```sh
cp scenario-b-upgrade/caller-rollout.yaml scenario-c-v3upgrade/
cp scenario-b-upgrade/receiver-rollout.yaml scenario-c-v3upgrade/
```

### 3. Update the YAML Files

Edit the rollout files for the new version:

```yaml
# In scenario-c-v3upgrade/caller-rollout.yaml
spec:
  template:
    metadata:
      labels:
        app: caller
        version: v3  # Update version label
    spec:
      containers:
      - name: caller
        image: allansli/caller:v3  # Update image tag
        env:
        - name: VERSION
          value: "v3"  # Update VERSION env var
```

```yaml
# Update service selectors at the bottom of the file
spec:
  selector:
    app: caller
    version: v3
```

Repeat the same pattern for the receiver rollout file.

### 4. Apply the Upgrade

Ensure the current version is stable before upgrading:

```sh
kubectl argo rollouts get rollout caller
kubectl argo rollouts get rollout receiver
```

Apply the new version rollouts:

```sh
kubectl apply -f scenario-c-v3upgrade/caller-rollout.yaml
kubectl apply -f scenario-c-v3upgrade/receiver-rollout.yaml
```

### 5. Monitor the Canary Progress

```sh
kubectl argo rollouts get rollout caller
kubectl argo rollouts get rollout receiver
```

### 6. Create a New Rollback Script (Optional)

For each major version, you may want to create a specific rollback script:

```bash
# rollback-to-v2.bat example
@echo off
echo ===== ROLLBACK TO V2 =====

echo Deleting current rollouts and services...
kubectl delete rollout caller receiver || true
kubectl delete service caller caller-canary receiver receiver-canary receiver-stable || true

echo Applying V2 Deployment...
kubectl apply -f scenario-b-upgrade/caller-rollout.yaml
kubectl apply -f scenario-b-upgrade/receiver-rollout.yaml

echo Checking status...
kubectl argo rollouts get rollout caller
kubectl argo rollouts get rollout receiver
```

This upgrade pattern can be repeated for any number of sequential versions (v3 → v4, v4 → v5, etc.) by following the same steps and incrementing the version numbers.

## License

MIT
