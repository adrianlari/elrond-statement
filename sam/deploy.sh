#!/bin/bash

STACK_NAME=register
REGION=us-east-1
S3_BUCKET=us-east-1-sam-bucket
TEMPLATE=template.yaml

rm build.yaml

sam validate --template $TEMPLATE

sam package \
  --template-file $TEMPLATE \
  --output-template-file build.yaml \
  --s3-bucket $S3_BUCKET

sam deploy \
  --region $REGION \
  --template-file build.yaml \
  --stack-name $STACK_NAME \
  --capabilities CAPABILITY_IAM
