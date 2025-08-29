#!/bin/bash

mkdir -p ./tmp

echo -e "-------------------------"
echo -e "Git credentials config..."

# BEGIN Git credential configuration
username=$(git config --get-all user.name)
if [[ -z "$username" ]]; then
    username=$(git remote -v | grep 'origin' | grep 'fetch' | awk -F'[@]' '{print $1}' | awk -F'//' '{print $2}')
    if [[ -z "$username" ]]; then
        # unexpected username - prompt for PS github account
        currentOriginUrl=$(git remote -v | grep 'origin' | grep 'fetch' | awk -F'[\t ]' '{print $2}')
        currentUsername=$username
        read -p "Enter Git username: " username
        # this is so the git credential manager does not keep prompting which account to use if the user has multiple accounts
        git remote set-url origin "${currentOriginUrl/$currentUsername/$username}"
    else
        echo "✓ Using $username"
    fi
else
    echo "✓ Using $username"
fi

github_email_save=tmp/github-email.txt
email=$(git config --get-all user.email)
if [[ $email != *@*.* && -f $github_email_save ]]; then
    email=$(<$github_email_save)
fi
if [[ $email != *@*.* ]]; then
    read -p "Enter Git email: " email
    # required for commits
    echo "$email" > $github_email_save
else
    echo "✓ Using $email"
fi

git config --global user.name "$username"
git config --global user.email "$email"

# END Git credential configuration

npm install n8n -g
&& npm install \
&& echo -e "\n------------------------\n✓ Dev Container ready!!!\n------------------------"